import isEqual from "lodash/isEqual";
import cloneDeep from "lodash/cloneDeep";
import merge from "lodash/merge";
import {
  AdornmentName,
  CardCost,
  CardName,
  CardType,
  EventName,
  Season,
  ResourceType,
  GameInput,
  GameInputType,
  TextPartPlayer,
  PlayedCardInfo,
  PlayedEventInfo,
  WorkerPlacementInfo,
  LocationName,
  LocationType,
  PlayerStatus,
  IGameTextEntity,
} from "./types";
import { PlayerJSON } from "./jsonTypes";
import { GameState } from "./gameState";
import { Adornment } from "./adornment";
import { Card } from "./card";
import { Event } from "./event";
import { Location } from "./location";
import { generate as uuid } from "short-uuid";
import { sumResources } from "./gameStatePlayHelpers";
import { assertUnreachable } from "../utils";

const MAX_HAND_SIZE = 8;
const MAX_CITY_SIZE = 15;

export class Player implements IGameTextEntity {
  private playerSecret: string;

  public name: string;
  public playerId: string;
  public cardsInHand: CardName[];

  private _currentSeason: Season;

  private resources: Record<ResourceType, number>;
  readonly playedCards: Partial<Record<CardName, PlayedCardInfo[]>>;
  readonly claimedEvents: Partial<Record<EventName, PlayedEventInfo>>;

  private numWorkers: number;
  private placedWorkers: WorkerPlacementInfo[];

  private numAmbassadors: number;

  public playerStatus: PlayerStatus;

  public adornmentsInHand: AdornmentName[];
  public playedAdornments: AdornmentName[];

  constructor({
    name,
    playerSecret = uuid(),
    playerId = uuid(),
    playedCards = {},
    cardsInHand = [],
    resources = {
      [ResourceType.VP]: 0,
      [ResourceType.TWIG]: 0,
      [ResourceType.BERRY]: 0,
      [ResourceType.PEBBLE]: 0,
      [ResourceType.RESIN]: 0,
      [ResourceType.PEARL]: 0,
    },
    currentSeason = Season.WINTER,
    numWorkers = 2,
    numAmbassadors = 0,
    claimedEvents = {},
    placedWorkers = [],
    playerStatus = PlayerStatus.DURING_SEASON,
    adornmentsInHand = [],
    playedAdornments = [],
  }: {
    name: string;
    playerSecret?: string;
    playerId?: string;
    playedCards?: Partial<Record<CardName, PlayedCardInfo[]>>;
    cardsInHand?: CardName[];
    resources?: Record<ResourceType, number>;
    currentSeason?: Season;
    numWorkers?: number;
    numAmbassadors?: number;
    claimedEvents?: Partial<Record<EventName, PlayedEventInfo>>;
    placedWorkers?: WorkerPlacementInfo[];
    playerStatus?: PlayerStatus;
    adornmentsInHand?: AdornmentName[];
    playedAdornments?: AdornmentName[];
  }) {
    this.playerId = playerId;
    this.playerSecret = playerSecret;
    this.name = name;
    this.playedCards = playedCards;
    this.cardsInHand = cardsInHand;
    this.resources = resources;
    this._currentSeason = currentSeason;
    this.numWorkers = numWorkers;
    this.claimedEvents = claimedEvents;
    this.placedWorkers = placedWorkers;
    this.playerStatus = playerStatus;

    // pearlbrook only
    this.numAmbassadors = numAmbassadors;
    this.adornmentsInHand = adornmentsInHand;
    this.playedAdornments = playedAdornments;
  }

  get playerSecretUNSAFE(): string {
    return this.playerSecret;
  }

  getGameTextPart(): TextPartPlayer {
    return {
      type: "player",
      playerId: this.playerId,
      name: this.name,
    };
  }

  drawCards(gameState: GameState, count: number): void {
    for (let i = 0; i < count; i++) {
      const drawnCard = gameState.drawCard();
      this.addCardToHand(gameState, drawnCard);
    }
  }

  drawMaxCards(gameState: GameState): number {
    const numDrawn = MAX_HAND_SIZE - this.cardsInHand.length;
    this.drawCards(gameState, numDrawn);
    return numDrawn;
  }

  addCardToHand(gameState: GameState, cardName: CardName): void {
    if (this.cardsInHand.length < MAX_HAND_SIZE) {
      this.cardsInHand.push(cardName);
    } else {
      gameState.discardPile.addToStack(cardName);
    }
  }

  removeCardFromHand(cardName: CardName): void {
    const idx = this.cardsInHand.indexOf(cardName);
    if (idx === -1) {
      throw new Error(`Unable to discard ${cardName}`);
    } else {
      this.cardsInHand.splice(idx, 1);
    }
  }

  addToCity(cardName: CardName): PlayedCardInfo {
    if (!this.canAddToCity(cardName, true /* strict */)) {
      throw new Error(`Unable to add ${cardName} to city`);
    }
    const card = Card.fromName(cardName);
    this.playedCards[cardName] = this.playedCards[cardName] || [];
    const playedCard = card.getPlayedCardInfo(this.playerId);
    this.playedCards[cardName]!.push(playedCard);
    return playedCard;
  }

  addToCityMulti(cards: CardName[]): void {
    cards.forEach((cardName) => this.addToCity(cardName));
  }

  removeCardFromCity(
    gameState: GameState,
    playedCardInfo: PlayedCardInfo,
    addToDiscardPile = true
  ): CardName[] {
    const { cardName, pairedCards = [] } = playedCardInfo;

    const playedCards = this.playedCards[cardName];
    if (!playedCards) {
      throw new Error(`Unable to remove ${JSON.stringify(playedCardInfo)}`);
    }

    // Get the actual object so we can splice it out.
    const playedCardInfo_ = playedCards.find((x) => isEqual(x, playedCardInfo));
    if (!playedCardInfo_) {
      throw new Error(`Unable to find ${JSON.stringify(playedCardInfo)}`);
    }
    const idx = playedCards.indexOf(playedCardInfo_);
    if (idx === -1) {
      throw new Error(`Unable to find ${JSON.stringify(playedCardInfo)}`);
    }

    // Remove playedCard
    playedCards.splice(idx, 1);

    // Some cards that contain other cards (eg. dungeon)
    const removedCards: CardName[] = [cardName, ...pairedCards];
    if (addToDiscardPile) {
      removedCards.forEach((card) => {
        gameState.discardPile.addToStack(card);
      });
    }
    return removedCards;
  }

  getNumOccupiedSpacesInCity(): number {
    let numOccupiedSpacesInCity = 0;
    this.forEachPlayedCard(({ cardName }) => {
      if (cardName === CardName.WANDERER) {
        return;
      }
      numOccupiedSpacesInCity += 1;
    });
    // Only count each husband/wife pair once
    numOccupiedSpacesInCity -= this.getNumHusbandWifePairs();
    return numOccupiedSpacesInCity;
  }

  canAddToCity(cardName: CardName, strict: boolean): boolean {
    const card = Card.fromName(cardName);
    if (card.isUnique && this.hasCardInCity(card.name)) {
      return false;
    }
    if (cardName === CardName.WANDERER) {
      return true;
    }

    // If strict is true, we're about to add this card to the city
    // otherwise, account for cards that can make space.
    if (!strict) {
      if (card.isCritter && this.hasCardInCity(CardName.INNKEEPER)) {
        return true;
      }
      if (card.isConstruction && this.hasCardInCity(CardName.CRANE)) {
        return true;
      }
      if (this.canInvokeDungeon()) {
        return true;
      }
    }

    if (
      cardName === CardName.RUINS &&
      this.getPlayedConstructions().length !== 0
    ) {
      return true;
    }

    if (cardName === CardName.HUSBAND || cardName === CardName.WIFE) {
      const numHusbands = (this.playedCards[CardName.HUSBAND] || []).length;
      const numWifes = (this.playedCards[CardName.WIFE] || []).length;
      if (cardName === CardName.HUSBAND && numHusbands < numWifes) {
        return true;
      }
      if (cardName === CardName.WIFE && numWifes < numHusbands) {
        return true;
      }
    }

    const numOccupiedSpacesInCity = this.getNumOccupiedSpacesInCity();
    return numOccupiedSpacesInCity < MAX_CITY_SIZE;
  }

  hasCardInCity(cardName: CardName): boolean {
    return this.getPlayedCardInfos(cardName).length !== 0;
  }

  useConstructionToPlayCritter(cardName: CardName): void {
    const card = Card.fromName(cardName);
    if (!card.isConstruction) {
      throw new Error("Can only occupy construction");
    }
    let didOccupy = false;
    this.getPlayedCardInfos(cardName).forEach((playedCardInfo) => {
      if (!didOccupy && !playedCardInfo.usedForCritter) {
        playedCardInfo.usedForCritter = true;
        didOccupy = true;
      }
    });
    if (!didOccupy) {
      throw new Error("No unoccupied construction found");
    }
  }

  getNumHusbandWifePairs(): number {
    const numHusbands = (this.playedCards[CardName.HUSBAND] || []).length;
    const numWifes = (this.playedCards[CardName.WIFE] || []).length;
    return Math.min(numHusbands, numWifes);
  }

  getPointsFromCards(gameState: GameState): number {
    let points = 0;
    this.forEachPlayedCard(({ cardName, resources = {} }) => {
      const card = Card.fromName(cardName);
      points += card.getPoints(gameState, this.playerId);
      points += resources[ResourceType.VP] || 0;
    });
    points += 3 * this.getNumHusbandWifePairs();
    return points;
  }

  getPointsFromEvents(gameState: GameState): number {
    let points = 0;
    Object.keys(this.claimedEvents).forEach((eventName) => {
      const event = Event.fromName(eventName as EventName);
      points += event.getPoints(gameState, this.playerId);
      const eventInfo = this.claimedEvents[eventName as EventName];
      if (eventInfo && eventInfo.storedResources) {
        points += eventInfo.storedResources[ResourceType.VP] || 0;
      }
    });
    return points;
  }

  getPointsFromJourney(gameState: GameState): number {
    let points = 0;
    this.placedWorkers.forEach((placeWorker) => {
      if (placeWorker.location) {
        const location = Location.fromName(placeWorker.location);
        points += location.getPoints(gameState, this.playerId);
      }
    });
    return points;
  }

  getPointsFromAdornments(gameState: GameState): number {
    let points = 0;
    this.playedAdornments.forEach((adornmentName) => {
      const adornment = Adornment.fromName(adornmentName as AdornmentName);
      points += adornment.getPoints(gameState, this.playerId);
    });
    return points;
  }

  getPoints(gameState: GameState): number {
    let points = 0;
    points += this.getPointsFromCards(gameState);
    points += this.getPointsFromEvents(gameState);
    points += this.getPointsFromJourney(gameState);
    points += this.getNumResourcesByType(ResourceType.VP);
    points += this.getNumResourcesByType(ResourceType.PEARL) * 2;
    points += this.getPointsFromAdornments(gameState);
    return points;
  }

  getResources(): Record<ResourceType, number> {
    return { ...this.resources };
  }

  getCardCostResources(): CardCost {
    return {
      [ResourceType.TWIG]: this.getNumResourcesByType(ResourceType.TWIG),
      [ResourceType.BERRY]: this.getNumResourcesByType(ResourceType.BERRY),
      [ResourceType.PEBBLE]: this.getNumResourcesByType(ResourceType.PEBBLE),
      [ResourceType.RESIN]: this.getNumResourcesByType(ResourceType.RESIN),
    };
  }

  getNumCardCostResources(): number {
    return (
      this.getNumResourcesByType(ResourceType.TWIG) +
      this.getNumResourcesByType(ResourceType.BERRY) +
      this.getNumResourcesByType(ResourceType.PEBBLE) +
      this.getNumResourcesByType(ResourceType.RESIN)
    );
  }

  getNumResources(): number {
    return sumResources(this.resources);
  }

  getNumResourcesByType(resourceType: ResourceType): number {
    return this.resources[resourceType];
  }

  getNumPlayedConstructions(): number {
    return this.getPlayedConstructions().length;
  }

  getNumPlayedUniqueConstructions(): number {
    return this.getPlayedConstructions().filter((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      return card.isUnique;
    }).length;
  }

  getNumPlayedCommonConstructions(): number {
    return this.getPlayedConstructions().filter((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      return !card.isUnique;
    }).length;
  }

  getNumPlayedUniqueCritters(): number {
    return this.getPlayedCritters().filter((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      return card.isUnique;
    }).length;
  }

  getNumPlayedCommonCritters(): number {
    return this.getPlayedCritters().filter((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      return !card.isUnique;
    }).length;
  }

  getNumPlayedCritters(): number {
    return this.getPlayedCritters().length;
  }

  getPlayedConstructions(): PlayedCardInfo[] {
    const constructionsInCity: PlayedCardInfo[] = [];
    this.forEachPlayedCard((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      if (card.isConstruction) {
        constructionsInCity.push(playedCardInfo);
      }
    });
    return constructionsInCity;
  }

  getPlayedCritters(): PlayedCardInfo[] {
    const crittersInCity: PlayedCardInfo[] = [];
    this.forEachPlayedCard((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      if (card.isCritter) {
        crittersInCity.push(playedCardInfo);
      }
    });
    return crittersInCity;
  }

  getPlayedCardNamesByType(cardType: CardType): CardName[] {
    const cards: CardName[] = [];
    this.forEachPlayedCard(({ cardName }) => {
      const card = Card.fromName(cardName);
      if (card.cardType == cardType) {
        cards.push(cardName);
      }
    });
    return cards;
  }

  forEachPlayedCard(callback: (playedCardInfo: PlayedCardInfo) => void): void {
    (Object.values(this.playedCards) as PlayedCardInfo[][]).forEach(
      (playedCards) => {
        playedCards.forEach(callback);
      }
    );
  }

  getNumCardsInCity(): number {
    let total = 0;
    this.forEachPlayedCard(() => {
      total += 1;
    });
    return total;
  }

  getNumCardType(cardType: CardType): number {
    return this.getPlayedCardNamesByType(cardType).length;
  }

  // Returns all played destination cards that a player has played that have
  // room for another worker
  getAllAvailableDestinationCards(): PlayedCardInfo[] {
    const ret: PlayedCardInfo[] = [];
    this.forEachPlayedCard((playedCard) => {
      const { cardName, workers = [] } = playedCard;
      const card = Card.fromName(cardName);
      if (card.getNumWorkerSpotsForPlayer(this) > workers.length) {
        ret.push(playedCard);
      }
    });
    return ret;
  }

  // returns all non-Open destination or storehouse cards that were played by player and
  // are available for them to put a worker on
  getAvailableClosedDestinationCards(): PlayedCardInfo[] {
    return this.getAllAvailableDestinationCards().filter(({ cardName }) => {
      const card = Card.fromName(cardName);
      return !card.isOpenDestination;
    });
  }

  // returns all destination cards played by this player that are "open"
  // and are available to take other workers
  getAvailableOpenDestinationCards(): PlayedCardInfo[] {
    return this.getAllAvailableDestinationCards().filter(({ cardName }) => {
      const card = Card.fromName(cardName);
      return card.isOpenDestination;
    });
  }

  getAllPlayedCards(): PlayedCardInfo[] {
    const ret: PlayedCardInfo[] = [];
    this.forEachPlayedCard((x) => ret.push(x));
    return ret;
  }

  getAllPlayedCardsByType(cardType: CardType): PlayedCardInfo[] {
    const ret: PlayedCardInfo[] = [];
    this.forEachPlayedCard((playedCardInfo) => {
      const card = Card.fromName(playedCardInfo.cardName);
      if (card.cardType === cardType) {
        ret.push(playedCardInfo);
      }
    });
    return ret;
  }

  getPlayedCardInfos(cardName: CardName): PlayedCardInfo[] {
    const playedCardInfos = this.playedCards[cardName];
    return playedCardInfos || [];
  }

  getFirstPlayedCard(cardName: CardName): PlayedCardInfo {
    const playedCards = this.getPlayedCardInfos(cardName);
    if (playedCards.length === 0) {
      throw new Error(`Cannot find played card for: ${cardName}`);
    }
    return playedCards[0];
  }

  updatePlayedCard(
    gameState: GameState,
    origPlayedCard: PlayedCardInfo,
    newPlayedCard: PlayedCardInfo
  ): void {
    let found = false;

    const origPlayedCardCopy = cloneDeep(origPlayedCard);
    this.getPlayedCardInfos(origPlayedCard.cardName).forEach((x) => {
      if (!found && isEqual(x, origPlayedCardCopy)) {
        merge(x, newPlayedCard);
        found = true;
      }
    });

    // Make sure we update all existing playedCardInfo references.
    gameState.updatePendingGameInputs((gameInput) => {
      switch (gameInput.inputType) {
        case GameInputType.SELECT_CARDS:
        case GameInputType.SELECT_LOCATION:
        case GameInputType.SELECT_PAYMENT_FOR_CARD:
        case GameInputType.SELECT_RESOURCES:
        case GameInputType.DISCARD_CARDS:
        case GameInputType.SELECT_PLAYER:
        case GameInputType.SELECT_WORKER_PLACEMENT:
        case GameInputType.SELECT_PLAYED_ADORNMENT:
          return gameInput;

        case GameInputType.SELECT_OPTION_GENERIC:
          if (
            gameInput.playedCardContext &&
            isEqual(gameInput.playedCardContext, origPlayedCardCopy)
          ) {
            return {
              ...gameInput,
              playedCardContext: newPlayedCard,
            };
          }
          return gameInput;
        case GameInputType.SELECT_PLAYED_CARDS:
          return {
            ...gameInput,
            cardOptions: gameInput.cardOptions.map((x) =>
              isEqual(x, origPlayedCardCopy) ? newPlayedCard : x
            ),
          };

        default:
          assertUnreachable(gameInput, JSON.stringify(gameInput, null, 2));
      }
    });

    if (!found) {
      throw new Error(
        `Cannot find played card for: ${
          origPlayedCard.cardName
        }\n ${JSON.stringify(origPlayedCard, null, 2)}`
      );
    }
  }

  findPlayedCard(
    playedCard: PlayedCardInfo
  ): Readonly<PlayedCardInfo> | undefined {
    const ret = this.getPlayedCardInfos(playedCard.cardName).find((x) => {
      return isEqual(x, playedCard);
    });
    if (ret) {
      return Object.freeze(ret);
    }
    // Be a little forgiving here because we might have stale references in pending gameInput.
    return this.getPlayedCardInfos(playedCard.cardName)[0];
  }

  hasUnusedByCritterConstruction(cardName: CardName): boolean {
    return !!(
      Card.fromName(cardName).isConstruction &&
      this.playedCards[cardName]?.some(
        (playedCard) => !playedCard.usedForCritter
      )
    );
  }

  canInvokeDungeon(): boolean {
    if (!this.hasCardInCity(CardName.DUNGEON)) {
      return false;
    }
    const playedDungeon = this.getFirstPlayedCard(CardName.DUNGEON);
    const numDungeoned = playedDungeon.pairedCards?.length || 0;
    const maxDungeoned = this.hasCardInCity(CardName.RANGER) ? 2 : 1;
    // Need to have a critter to dungeon
    const playedCritters = this.getPlayedCritters();
    if (
      playedCritters.length === 0 ||
      (playedCritters.length === 1 &&
        playedCritters[0].cardName === CardName.RANGER)
    ) {
      return false;
    }
    return numDungeoned < maxDungeoned;
  }

  get numAvailableWorkers(): number {
    return this.numWorkers - this.placedWorkers.length;
  }

  activateProduction(gameState: GameState, gameInput: GameInput): void {
    this.getAllPlayedCardsByType(CardType.PRODUCTION).forEach((playedCard) => {
      const card = Card.fromName(playedCard.cardName);
      card.activateCard(gameState, gameInput, this, playedCard);
    });
  }

  placeWorkerOnLocation(location: LocationName): void {
    this.placeWorkerCommon({
      location,
    });
  }

  placeWorkerOnEvent(eventName: EventName): void {
    this.placeWorkerCommon({ event: eventName });

    const event = Event.fromName(eventName);
    this.claimedEvents[eventName] = event.getPlayedEventInfo();
  }

  placeWorkerOnCard(gameState: GameState, playedCard: PlayedCardInfo): void {
    const { cardName, cardOwnerId } = playedCard;
    const cardOwner = gameState.getPlayer(cardOwnerId);
    const card = Card.fromName(cardName);

    const origPlayedCard = cardOwner.findPlayedCard(playedCard);
    if (!origPlayedCard) {
      throw new Error(
        `Could not find played card: ${JSON.stringify(playedCard, null, 2)}`
      );
    }

    if (!this.canPlaceWorkerOnCard(origPlayedCard)) {
      throw new Error(
        `Cannot place worker on card: ${JSON.stringify(playedCard, null, 2)}`
      );
    }

    const workers = origPlayedCard.workers || [];
    if (workers.length >= card.getNumWorkerSpotsForPlayer(cardOwner)) {
      throw new Error(`Couldn't place worker: ${JSON.stringify(playedCard)}`);
    }

    workers.push(this.playerId);

    cardOwner.updatePlayedCard(gameState, origPlayedCard, {
      ...cloneDeep(origPlayedCard),
      workers,
    });

    this.placeWorkerCommon({ playedCard });
  }

  private placeWorkerCommon(workerPlacementInfo: WorkerPlacementInfo): void {
    if (this.numAvailableWorkers === 0) {
      throw new Error(`Cannot place worker`);
    }
    this.placedWorkers.push(workerPlacementInfo);
  }

  canPlaceWorkerOnCard(playedCard: PlayedCardInfo | undefined): boolean {
    if (!playedCard) {
      return false;
    }
    if (this.numAvailableWorkers <= 0) {
      return false;
    }
    const { cardName, cardOwnerId, workers = [] } = playedCard;
    const card = Card.fromName(cardName);
    if (cardOwnerId !== this.playerId && !card.isOpenDestination) {
      return false;
    }

    return card.getNumWorkerSpotsForPlayer(this) > workers.length;
  }

  canAffordCard(
    cardName: CardName,
    isMeadowCard: boolean,
    forceDiscount: "ANY 1" | null = null
  ): boolean {
    const card = Card.fromName(cardName);

    // if we are forcing a specific discount, don't do any other check +
    // enforce that this discount is used
    if (forceDiscount) {
      return this.isPaidResourcesValid(
        this.resources,
        card.baseCost,
        "ANY 1",
        false
      );
    }

    // Check if you have the associated construction if card is a critter
    if (card.isCritter) {
      if (this.hasUnusedByCritterConstruction(CardName.EVERTREE)) {
        return true;
      }
      if (
        card.associatedCard &&
        this.hasUnusedByCritterConstruction(card.associatedCard)
      ) {
        return true;
      }
    }

    // Queen (below 3 vp free)
    if (
      card.baseVP <= 3 &&
      this.hasCardInCity(CardName.QUEEN) &&
      this.canPlaceWorkerOnCard(this.getFirstPlayedCard(CardName.QUEEN))
    ) {
      return true;
    }

    // Innkeeper (3 berries less)
    if (
      card.baseCost[ResourceType.BERRY] &&
      card.isCritter &&
      this.hasCardInCity(CardName.INNKEEPER) &&
      this.isPaidResourcesValid(
        this.resources,
        card.baseCost,
        ResourceType.BERRY,
        false
      )
    ) {
      return true;
    }
    const wildDiscount =
      // Dungeon
      this.canInvokeDungeon() ||
      // Crane
      (card.isConstruction && this.hasCardInCity(CardName.CRANE));

    return this.isPaidResourcesValid(
      this.resources,
      card.baseCost,
      wildDiscount ? "ANY 3" : null,
      false
    );
  }

  validatePaidResources(
    paidResources: CardCost,
    cardCost: CardCost,
    // Discounts are exclusive so we use a single argument to represent them
    discount: ResourceType.BERRY | "ANY 3" | "ANY 1" | null = null,
    errorIfOverpay = true
  ): string | null {
    const needToPay = {
      [ResourceType.TWIG]: cardCost[ResourceType.TWIG] || 0,
      [ResourceType.BERRY]: cardCost[ResourceType.BERRY] || 0,
      [ResourceType.PEBBLE]: cardCost[ResourceType.PEBBLE] || 0,
      [ResourceType.RESIN]: cardCost[ResourceType.RESIN] || 0,
    };
    const payingWith = {
      [ResourceType.TWIG]: paidResources[ResourceType.TWIG] || 0,
      [ResourceType.BERRY]: paidResources[ResourceType.BERRY] || 0,
      [ResourceType.PEBBLE]: paidResources[ResourceType.PEBBLE] || 0,
      [ResourceType.RESIN]: paidResources[ResourceType.RESIN] || 0,
    };
    const outstandingOwed = {
      [ResourceType.TWIG]: 0,
      [ResourceType.BERRY]: 0,
      [ResourceType.PEBBLE]: 0,
      [ResourceType.RESIN]: 0,
    };

    const needToPaySum = sumResources(needToPay);
    const payingWithSum = sumResources(payingWith);

    // Take discounts first
    if (discount === ResourceType.BERRY) {
      needToPay[ResourceType.BERRY] = Math.max(
        0,
        needToPay[ResourceType.BERRY] - 3
      );
    }

    (Object.entries(needToPay) as [keyof CardCost, number][]).forEach(
      ([resourceType, count]) => {
        if (count <= payingWith[resourceType]) {
          payingWith[resourceType] -= count;
        } else {
          count -= payingWith[resourceType];
          payingWith[resourceType] = 0;
          outstandingOwed[resourceType] += count;
        }
      }
    );

    const outstandingOwedSum = sumResources(outstandingOwed);
    const payingWithRemainerSum = sumResources(payingWith);

    // With wild discount, should have outstandingOwedSum left
    if (discount === "ANY 3" && outstandingOwedSum <= 3) {
      if (
        errorIfOverpay &&
        payingWithSum !== 0 &&
        payingWithSum + 3 > needToPaySum
      ) {
        return "Cannot overpay for cards";
      }
      return null;
    }

    if (discount === "ANY 1" && outstandingOwedSum <= 1) {
      if (
        errorIfOverpay &&
        payingWithSum !== 0 &&
        payingWithSum + 1 > needToPaySum
      ) {
        return "Cannot overpay for cards";
      }
      return null;
    }

    // Can only use judge if no other discounts are in effect
    if (!discount && this.hasCardInCity(CardName.JUDGE)) {
      if (outstandingOwedSum === 1) {
        if (payingWithRemainerSum >= 1) {
          if (errorIfOverpay && payingWithRemainerSum !== 1) {
            return "Cannot overpay for cards";
          }
          return null;
        }
      }
    }
    if (
      outstandingOwedSum === 0 &&
      payingWithRemainerSum !== 0 &&
      errorIfOverpay
    ) {
      return "Cannot overpay for cards";
    }
    if (outstandingOwedSum !== 0) {
      return `Paid resources is insufficient: paid=${JSON.stringify(
        paidResources
      )}, cost=${JSON.stringify(cardCost)}, discount=${discount}`;
    }
    return null;
  }

  isPaidResourcesValid(
    paidResources: CardCost,
    cardCost: CardCost,
    // Discounts are exclusive so we use a single argument to represent them
    discount: ResourceType.BERRY | "ANY 3" | "ANY 1" | null = null,
    errorIfOverpay = true
  ): boolean {
    return !this.validatePaidResources(
      paidResources,
      cardCost,
      discount,
      errorIfOverpay
    );
  }

  payForCard(
    gameState: GameState,
    gameInput: GameInput & {
      inputType:
        | GameInputType.PLAY_CARD
        | GameInputType.SELECT_PAYMENT_FOR_CARD;
    }
  ): void {
    if (!gameInput.clientOptions?.card) {
      throw new Error(`Must specify card to pay for`);
    }
    const card = Card.fromName(gameInput.clientOptions.card);
    const paymentOptions = gameInput.clientOptions.paymentOptions;
    const paymentResources = paymentOptions.resources;

    this.spendResources(paymentResources);

    if (paymentOptions.useAssociatedCard) {
      let hasUsed = false;
      const playedCardsToCheck: PlayedCardInfo[] = [];
      if (card.associatedCard) {
        playedCardsToCheck.push(
          ...this.getPlayedCardInfos(card.associatedCard)
        );
      }
      playedCardsToCheck.push(...this.getPlayedCardInfos(CardName.EVERTREE));
      playedCardsToCheck.forEach((playedCard) => {
        if (!hasUsed) {
          if (!playedCard.usedForCritter) {
            playedCard.usedForCritter = true;
            hasUsed = true;
          }
        }
      });
    }

    if (paymentOptions.cardToDungeon) {
      const playedDungeon = this.getFirstPlayedCard(CardName.DUNGEON);
      this.removeCardFromCity(
        gameState,
        this.getFirstPlayedCard(paymentOptions.cardToDungeon)
      );
      playedDungeon.pairedCards!.push(paymentOptions.cardToDungeon);
    } else if (paymentOptions.cardToUse) {
      switch (paymentOptions.cardToUse) {
        case CardName.CRANE:
          this.removeCardFromCity(
            gameState,
            this.getFirstPlayedCard(CardName.CRANE)
          );
          break;
        case CardName.INNKEEPER:
          this.removeCardFromCity(
            gameState,
            this.getFirstPlayedCard(CardName.INNKEEPER)
          );
          break;
        case CardName.QUEEN:
        case CardName.INN:
          if (gameInput.inputType === GameInputType.PLAY_CARD) {
            this.placeWorkerOnCard(
              gameState,
              this.getFirstPlayedCard(paymentOptions.cardToUse)
            );
          }
          break;
        default:
          assertUnreachable(
            paymentOptions.cardToUse,
            `Unexpected card: ${paymentOptions.cardToUse}`
          );
      }
    }
  }

  validatePaymentOptions(
    gameInput: GameInput & { inputType: GameInputType.PLAY_CARD }
  ): string | null {
    if (!gameInput.clientOptions?.card) {
      return `Must specify card to play`;
    }
    if (!gameInput?.clientOptions?.paymentOptions?.resources) {
      return `Invalid input: missing clientOptions.paymentOptions.resources in gameInput: ${JSON.stringify(
        gameInput,
        null,
        2
      )}`;
    }

    const paymentOptions = gameInput.clientOptions.paymentOptions;
    const paymentResources = paymentOptions.resources;

    // Validate if player has resources specified by payment options
    const resourceToPayList = Object.entries(paymentResources) as [
      ResourceType,
      number
    ][];
    for (let i = 0; i < resourceToPayList.length; i++) {
      const [resourceType, count] = resourceToPayList[i];
      if (this.getNumResourcesByType(resourceType) < count) {
        return `Can't spend ${count} ${resourceType}, you have: ${this.getNumResourcesByType(
          resourceType
        )}`;
      }
    }

    // Validate if payment options are valid for the card
    const cardToPlay = Card.fromName(gameInput.clientOptions.card);

    // Check if you have the associated construction if card is a critter
    if (paymentOptions.useAssociatedCard) {
      if (!cardToPlay.isCritter || !cardToPlay.associatedCard) {
        return `Cannot use associated card to play ${cardToPlay.name}`;
      }

      if (
        !this.hasUnusedByCritterConstruction(CardName.EVERTREE) &&
        !this.hasUnusedByCritterConstruction(cardToPlay.associatedCard)
      ) {
        return `Cannot find associated card to play ${cardToPlay.name}`;
      }
      return null;
    }

    if (paymentOptions.cardToDungeon) {
      if (!this.canInvokeDungeon()) {
        return `Unable to invoke ${CardName.DUNGEON}`;
      }
      if (!Card.fromName(paymentOptions.cardToDungeon).isCritter) {
        return `Unable to dungeon ${paymentOptions.cardToDungeon}. It is not a critter.`;
      }
      return this.validatePaidResources(
        paymentResources,
        cardToPlay.baseCost,
        "ANY 3"
      );
    }
    if (paymentOptions.cardToUse) {
      if (!this.hasCardInCity(paymentOptions.cardToUse)) {
        return `Unable to find ${paymentOptions.cardToUse} in your city`;
      }
      switch (paymentOptions.cardToUse) {
        case CardName.CRANE:
          if (!cardToPlay.isConstruction) {
            return `Unable to use ${CardName.CRANE} to play ${cardToPlay.name}. It is not a construction.`;
          }
          return this.validatePaidResources(
            paymentResources,
            cardToPlay.baseCost,
            "ANY 3"
          );
        case CardName.QUEEN:
          if (cardToPlay.baseVP > 3) {
            return `Cannot use ${CardName.QUEEN} to play ${cardToPlay.name} (baseVP: ${cardToPlay.baseVP})`;
          }
          return null;
        case CardName.INN:
          // TODO check if we can place a worker here
          if (!gameInput.clientOptions.fromMeadow) {
            return `Cannot use ${CardName.INN} to play a non-meadow card`;
          }
          return this.validatePaidResources(
            paymentResources,
            cardToPlay.baseCost,
            "ANY 3"
          );
        case CardName.INNKEEPER:
          if (!cardToPlay.isCritter) {
            return `Unable to use ${CardName.INNKEEPER} to play ${cardToPlay.name}. It is not a critter.`;
          }
          return this.validatePaidResources(
            paymentResources,
            cardToPlay.baseCost,
            ResourceType.BERRY
          );
        default:
          assertUnreachable(
            paymentOptions.cardToUse,
            `Unexpected card: ${paymentOptions.cardToUse}`
          );
      }
    }
    return this.validatePaidResources(paymentResources, cardToPlay.baseCost);
  }

  spendResources({
    VP = 0,
    TWIG = 0,
    BERRY = 0,
    PEBBLE = 0,
    RESIN = 0,
    PEARL = 0,
  }: {
    [ResourceType.VP]?: number;
    [ResourceType.TWIG]?: number;
    [ResourceType.BERRY]?: number;
    [ResourceType.PEBBLE]?: number;
    [ResourceType.RESIN]?: number;
    [ResourceType.PEARL]?: number;
  }): void {
    if (VP) {
      if (this.resources[ResourceType.VP] < VP) {
        throw new Error(
          `Insufficient ${ResourceType.VP}. Need ${VP}, but only have ${
            this.resources[ResourceType.VP]
          }`
        );
      }
      this.resources[ResourceType.VP] -= VP;
    }
    if (TWIG) {
      if (this.resources[ResourceType.TWIG] < TWIG) {
        throw new Error(
          `Insufficient ${ResourceType.TWIG}. Need ${TWIG}, but only have ${
            this.resources[ResourceType.TWIG]
          } TWIG`
        );
      }
      this.resources[ResourceType.TWIG] -= TWIG;
    }
    if (BERRY) {
      if (this.resources[ResourceType.BERRY] < BERRY) {
        throw new Error(
          `Insufficient ${ResourceType.BERRY}. Need ${BERRY}, but only have ${
            this.resources[ResourceType.BERRY]
          } BERRY`
        );
      }
      this.resources[ResourceType.BERRY] -= BERRY;
    }
    if (PEBBLE) {
      if (this.resources[ResourceType.PEBBLE] < PEBBLE) {
        throw new Error(
          `Insufficient ${ResourceType.PEBBLE}. Need ${PEBBLE}, but only have ${
            this.resources[ResourceType.PEBBLE]
          } PEBBLE`
        );
      }
      this.resources[ResourceType.PEBBLE] -= PEBBLE;
    }
    if (RESIN) {
      if (this.resources[ResourceType.RESIN] < RESIN) {
        throw new Error(
          `Insufficient ${ResourceType.RESIN}. Need ${RESIN}, but only have ${
            this.resources[ResourceType.RESIN]
          } RESIN`
        );
      }
      this.resources[ResourceType.RESIN] -= RESIN;
    }
    if (PEARL) {
      if (this.resources[ResourceType.PEARL] < PEARL) {
        throw new Error(
          `Insufficient ${ResourceType.PEARL}. Need ${PEARL}, but only have ${
            this.resources[ResourceType.PEARL]
          } PEARL`
        );
      }
      this.resources[ResourceType.PEARL] -= PEARL;
    }
  }

  gainResources({
    VP = 0,
    TWIG = 0,
    BERRY = 0,
    PEBBLE = 0,
    RESIN = 0,
    PEARL = 0,
  }: {
    [ResourceType.VP]?: number;
    [ResourceType.TWIG]?: number;
    [ResourceType.BERRY]?: number;
    [ResourceType.PEBBLE]?: number;
    [ResourceType.RESIN]?: number;
    [ResourceType.PEARL]?: number;
  }): void {
    if (VP) {
      this.resources[ResourceType.VP] += VP;
    }
    if (TWIG) {
      this.resources[ResourceType.TWIG] += TWIG;
    }
    if (BERRY) {
      this.resources[ResourceType.BERRY] += BERRY;
    }
    if (PEBBLE) {
      this.resources[ResourceType.PEBBLE] += PEBBLE;
    }
    if (RESIN) {
      this.resources[ResourceType.RESIN] += RESIN;
    }
    if (PEARL) {
      this.resources[ResourceType.PEARL] += PEARL;
    }
  }

  isRecallableWorker(workerPlacementInfo: WorkerPlacementInfo): boolean {
    // Don't remove workers from these cards.
    if (
      workerPlacementInfo.playedCard &&
      (workerPlacementInfo.playedCard.cardName === CardName.CEMETARY ||
        workerPlacementInfo.playedCard.cardName === CardName.MONASTERY)
    ) {
      return false;
    }
    if (workerPlacementInfo.location) {
      const location = Location.fromName(workerPlacementInfo.location);
      if (location.type === LocationType.JOURNEY) {
        return false;
      }
    }
    return true;
  }

  getRecallableWorkers(): WorkerPlacementInfo[] {
    return this.placedWorkers.filter(this.isRecallableWorker);
  }

  recallWorker(
    gameState: GameState,
    workerPlacementInfo: WorkerPlacementInfo,
    opts: {
      removeFromGameState?: boolean;
      removeFromPlacedWorkers?: boolean;
    } = {}
  ): void {
    const { removeFromGameState = true, removeFromPlacedWorkers = true } = opts;
    if (!this.isRecallableWorker(workerPlacementInfo)) {
      throw new Error("Cannot recall worker");
    }
    if (removeFromPlacedWorkers) {
      const toRemove:
        | WorkerPlacementInfo
        | undefined = this.placedWorkers.find((placedWorker) =>
        isEqual(placedWorker, workerPlacementInfo)
      );
      if (!toRemove) {
        throw new Error("Cannot find worker");
      }
      this.placedWorkers.splice(this.placedWorkers.indexOf(toRemove), 1);
    }
    if (removeFromGameState) {
      const { location, playedCard, event } = workerPlacementInfo;
      // Update gameState/other objects
      if (location) {
        const workers = gameState.locationsMap[location];
        if (!workers) {
          throw new Error(`Couldn't find location ${location}`);
        }
        const idx = workers.indexOf(this.playerId);
        if (idx !== -1) {
          workers.splice(idx, 1);
        } else {
          throw new Error(`Couldn't find worker at location: ${location}`);
        }
      } else if (event) {
        // Don't need to do anything for event
      } else if (playedCard) {
        const cardOwner = gameState.getPlayer(playedCard.cardOwnerId);
        let removedWorker = false;
        cardOwner
          .getPlayedCardInfos(playedCard.cardName)
          .forEach(({ workers = [] }) => {
            if (!removedWorker) {
              const idx = workers.indexOf(this.playerId);
              if (idx !== -1) {
                workers.splice(idx, 1);
                removedWorker = true;
              }
            }
          });
      } else {
        throw new Error(
          `Unexpected Worker Placement: ${JSON.stringify(
            workerPlacementInfo,
            null,
            2
          )}`
        );
      }
    }
  }

  useAmbassador(): void {
    this.numAmbassadors = 0;
  }

  hasUnusedAmbassador(): boolean {
    return this.numAmbassadors === 1;
  }

  recallAmbassador(gameState: GameState): void {
    if (!gameState.gameOptions.pearlbrook) {
      return;
    }
    // TODO: Update gameState riverDestinationMap & Ferry
    this.numAmbassadors = 1;
  }

  recallWorkers(gameState: GameState): void {
    if (this.numAvailableWorkers !== 0) {
      throw new Error("Still have available workers");
    }
    this.placedWorkers = this.placedWorkers.filter((workerPlacementInfo) => {
      if (this.isRecallableWorker(workerPlacementInfo)) {
        this.recallWorker(gameState, workerPlacementInfo, {
          removeFromPlacedWorkers: false,
        });
        return false;
      } else {
        return true;
      }
    });
  }

  get currentSeason(): Season {
    return this._currentSeason;
  }

  nextSeason(): void {
    if (this._currentSeason === Season.WINTER) {
      this._currentSeason = Season.SPRING;
      this.numWorkers = 3;
    } else if (this._currentSeason === Season.SPRING) {
      this._currentSeason = Season.SUMMER;
      this.numWorkers = 4;
    } else if (this._currentSeason === Season.SUMMER) {
      this._currentSeason = Season.AUTUMN;
      this.numWorkers = 6;
    } else {
      throw new Error("Already in the last season");
    }
  }

  toJSON(includePrivate: boolean): PlayerJSON {
    return cloneDeep({
      name: this.name,
      playerId: this.playerId,
      playedCards: this.playedCards,
      numCardsInHand: this.cardsInHand.length,
      resources: this.resources,
      numWorkers: this.numWorkers,
      currentSeason: this.currentSeason,
      claimedEvents: this.claimedEvents,
      numAmbassadors: this.numAmbassadors,
      cardsInHand: [],
      placedWorkers: this.placedWorkers,
      playerStatus: this.playerStatus,
      ...(includePrivate
        ? {
            playerSecret: this.playerSecret,
            cardsInHand: this.cardsInHand,
          }
        : {}),
      adornmentsInHand: this.adornmentsInHand,
      playedAdornments: this.playedAdornments,
    });
  }

  static fromJSON(playerJSON: PlayerJSON): Player {
    const player = new Player(playerJSON);
    return player;
  }
}

export const createPlayer = (name: string): Player => {
  const player = new Player({
    name,
  });
  return player;
};
