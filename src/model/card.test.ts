import expect from "expect.js";
import { Card } from "./card";
import { Location } from "./location";
import { GameState } from "./gameState";
import { Player } from "./player";
import {
  testInitialGameState,
  multiStepGameInputTest,
  playCardInput,
} from "./testHelpers";
import {
  CardType,
  EventName,
  LocationType,
  ResourceType,
  GameInputType,
  CardName,
  Season,
  LocationName,
} from "./types";

describe("Card", () => {
  let gameState: GameState;
  let player: Player;

  beforeEach(() => {
    gameState = testInitialGameState();
    player = gameState.getActivePlayer();
  });

  describe("fromName", () => {
    it("should return the expect Card instances", () => {
      Object.values(CardName).forEach((card) => {
        expect(Card.fromName(card as CardName).name).to.be(card);
      });
    });
  });

  describe("Card destinations", () => {
    it("Inn should be marked as an open destination", () => {
      const card = Card.fromName(CardName.INN);
      expect(card.cardType).to.be(CardType.DESTINATION);

      const isOpenDestination = card.isOpenDestination;
      expect(isOpenDestination).to.be(true);
    });

    it("Queen should be marked as a destination, but not open", () => {
      const card = Card.fromName(CardName.QUEEN);
      expect(card.cardType).to.be(CardType.DESTINATION);

      const isOpenDestination = card.isOpenDestination;
      expect(isOpenDestination).to.be(false);
    });

    it("Storehouse is not a destination card, but can have a worker placed on it", () => {
      let card = Card.fromName(CardName.STOREHOUSE);
      expect(card.cardType).to.be(CardType.PRODUCTION);
      expect(
        card.getNumWorkerSpotsForPlayer(gameState.getActivePlayer())
      ).to.be(1);

      card = Card.fromName(CardName.POST_OFFICE);
      expect(card.cardType).to.be(CardType.DESTINATION);
      expect(
        card.getNumWorkerSpotsForPlayer(gameState.getActivePlayer())
      ).to.be(1);

      card = Card.fromName(CardName.FARM);
      expect(
        card.getNumWorkerSpotsForPlayer(gameState.getActivePlayer())
      ).to.be(0);
    });
  });

  describe("Card Specific", () => {
    describe(CardName.ARCHITECT, () => {
      it("should be worth 1 VP per unused RESIN/PEBBLE", () => {
        const card = Card.fromName(CardName.ARCHITECT);

        expect(card.getPoints(gameState, player.playerId)).to.be(2);

        player.gainResources({ [ResourceType.PEBBLE]: 1 });
        expect(card.getPoints(gameState, player.playerId)).to.be(3);

        player.gainResources({ [ResourceType.RESIN]: 2 });
        expect(card.getPoints(gameState, player.playerId)).to.be(5);
      });

      it("should be worth 1 VP per unused RESIN/PEBBLE up to 6 MAX", () => {
        const card = Card.fromName(CardName.ARCHITECT);

        expect(card.getPoints(gameState, player.playerId)).to.be(2);

        player.gainResources({ [ResourceType.PEBBLE]: 10 });
        player.gainResources({ [ResourceType.RESIN]: 10 });
        expect(card.getPoints(gameState, player.playerId)).to.be(2 + 6);
      });
    });

    describe(CardName.BARD, () => {
      it("should not prompt is user has no cards to discard", () => {
        const card = Card.fromName(CardName.BARD);

        player.cardsInHand = [card.name];
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        [player, gameState] = multiStepGameInputTest(
          gameState,
          [playCardInput(card.name)],
          { autoAdvance: true }
        );

        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
        expect(player.cardsInHand).to.eql([]);
      });

      it("should gain vp corresponding to no. of discarded cards", () => {
        const card = Card.fromName(CardName.BARD);

        player.cardsInHand = [CardName.BARD, CardName.FARM, CardName.RUINS];
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.DISCARD_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.BARD,
            minCards: 0,
            maxCards: 5,
            clientOptions: {
              cardsToDiscard: [CardName.FARM, CardName.RUINS],
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(2);
        expect(player.cardsInHand).to.eql([]);
      });

      it("should not allow more than 5 discarded cards", () => {
        const card = Card.fromName(CardName.BARD);
        const gameInput = playCardInput(card.name);

        player.cardsInHand = [
          CardName.BARD,
          CardName.FARM,
          CardName.RUINS,
          CardName.FARM,
          CardName.RUINS,
          CardName.FARM,
          CardName.RUINS,
        ];
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        gameState = gameState.next(gameInput);
        player = gameState.getPlayer(player.playerId);
        expect(player.playerId).to.be(gameState.getActivePlayer().playerId);
        expect(gameState.pendingGameInputs).to.eql([
          {
            inputType: GameInputType.DISCARD_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.BARD,
            label: "Discard up to 5 CARD to gain 1 VP each",
            minCards: 0,
            maxCards: 5,
            clientOptions: {
              cardsToDiscard: [],
            },
          },
        ]);

        expect(() => {
          gameState.next({
            inputType: GameInputType.DISCARD_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.BARD,
            minCards: 0,
            maxCards: 5,
            clientOptions: {
              cardsToDiscard: [
                CardName.BARD,
                CardName.FARM,
                CardName.RUINS,
                CardName.FARM,
                CardName.RUINS,
                CardName.FARM,
              ],
            },
          });
        }).to.throwException(/too many cards/);

        expect(() => {
          gameState.next({
            inputType: GameInputType.DISCARD_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.BARD,
            minCards: 0,
            maxCards: 5,
            clientOptions: {
              // Player doesn't have queen
              cardsToDiscard: [CardName.QUEEN],
            },
          });
        }).to.throwException(/unable to discard/i);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
      });
    });

    describe(CardName.BARGE_TOAD, () => {
      it("should gain 0 TWIG if no FARM in city", () => {
        const card = Card.fromName(CardName.BARGE_TOAD);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);

        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      });

      it("should gain 2 TWIG if one FARM in city", () => {
        const card = Card.fromName(CardName.BARGE_TOAD);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);
        player.addToCity(CardName.FARM);

        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
      });

      it("should gain 2 TWIG per FARM in city", () => {
        const card = Card.fromName(CardName.BARGE_TOAD);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.FARM);

        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(8);
      });
    });

    describe(CardName.CASTLE, () => {
      it("should be worth 1 VP per common construction", () => {
        const card = Card.fromName(CardName.CASTLE);
        player.addToCity(card.name);

        expect(card.getPoints(gameState, player.playerId)).to.be(4);

        player.addToCity(CardName.FARM);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.FARM);
        expect(card.getPoints(gameState, player.playerId)).to.be(4 + 3);
      });

      it("does not count unique constructions / critters", () => {
        const card = Card.fromName(CardName.CASTLE);
        player.addToCity(card.name);

        expect(card.getPoints(gameState, player.playerId)).to.be(4);

        player.addToCity(CardName.EVERTREE);
        player.addToCity(CardName.PALACE);
        player.addToCity(CardName.DUNGEON);
        expect(card.getPoints(gameState, player.playerId)).to.be(4);

        player.addToCity(CardName.WIFE);
        player.addToCity(CardName.RANGER);
        player.addToCity(CardName.QUEEN);
        expect(card.getPoints(gameState, player.playerId)).to.be(4);
      });
    });

    describe(CardName.CEMETARY, () => {
      it("allow player to play one revealed card", () => {
        player.addToCity(CardName.CEMETARY);

        // Add some cards to make sure we only give player valid options.
        player.addToCity(CardName.UNIVERSITY);
        player.addToCity(CardName.KING);
        player.addToCity(CardName.FARM);

        // Add some cards to the discard pile.
        gameState.discardPile.addToStack(CardName.FARM);
        gameState.discardPile.addToStack(CardName.FARM);
        gameState.discardPile.addToStack(CardName.FARM);
        gameState.discardPile.addToStack(CardName.FARM);

        gameState.deck.addToStack(CardName.KING);
        gameState.deck.addToStack(CardName.QUEEN);
        gameState.deck.addToStack(CardName.FARM);
        gameState.deck.addToStack(CardName.UNIVERSITY);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.CEMETARY),
            },
          },
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            options: ["Deck", "Discard Pile"],
            cardContext: CardName.CEMETARY,
            clientOptions: {
              selectedOption: "Deck",
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.SELECT_OPTION_GENERIC,
            cardContext: CardName.CEMETARY,
            cardOptions: [CardName.FARM, CardName.QUEEN],
            cardOptionsUnfiltered: [
              CardName.UNIVERSITY,
              CardName.FARM,
              CardName.QUEEN,
              CardName.KING,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.QUEEN],
            },
          },
        ]);

        expect(player.hasCardInCity(CardName.QUEEN)).to.be(true);
      });

      it("skip card selection if none are playable", () => {
        player.addToCity(CardName.CEMETARY);

        // Add some cards to make sure we only give player valid options.
        player.addToCity(CardName.UNIVERSITY);
        player.addToCity(CardName.KING);

        // Add some cards to the discard pile.
        gameState.discardPile.addToStack(CardName.FARM);
        gameState.discardPile.addToStack(CardName.FARM);
        gameState.discardPile.addToStack(CardName.FARM);
        gameState.discardPile.addToStack(CardName.FARM);

        gameState.deck.addToStack(CardName.KING);
        gameState.deck.addToStack(CardName.KING);
        gameState.deck.addToStack(CardName.KING);
        gameState.deck.addToStack(CardName.KING);

        expect(player.numAvailableWorkers).to.be(2);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.CEMETARY),
            },
          },
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            options: ["Deck", "Discard Pile"],
            cardContext: CardName.CEMETARY,
            clientOptions: {
              selectedOption: "Deck",
            },
          },
        ]);
      });

      it("should auto advance if there aren't any cards in the discard pile", () => {
        player.addToCity(CardName.CEMETARY);

        expect(gameState.discardPile.length).to.be(0);
        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);

        gameState.deck.addToStack(CardName.KING);
        gameState.deck.addToStack(CardName.QUEEN);
        gameState.deck.addToStack(CardName.FARM);
        gameState.deck.addToStack(CardName.UNIVERSITY);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);

        [player, gameState] = multiStepGameInputTest(
          gameState,
          [
            {
              inputType: GameInputType.VISIT_DESTINATION_CARD,
              clientOptions: {
                playedCard: player.getFirstPlayedCard(CardName.CEMETARY),
              },
            },
            {
              inputType: GameInputType.SELECT_CARDS,
              prevInputType: GameInputType.SELECT_OPTION_GENERIC,
              cardContext: CardName.CEMETARY,
              cardOptions: [
                CardName.UNIVERSITY,
                CardName.FARM,
                CardName.QUEEN,
                CardName.KING,
              ],
              cardOptionsUnfiltered: [
                CardName.UNIVERSITY,
                CardName.FARM,
                CardName.QUEEN,
                CardName.KING,
              ],
              maxToSelect: 1,
              minToSelect: 1,
              clientOptions: {
                selectedCards: [CardName.QUEEN],
              },
            },
          ],
          { autoAdvance: true }
        );

        expect(player.hasCardInCity(CardName.QUEEN)).to.be(true);
      });

      it("should not allow discard pile as an option if there aren't any cards there", () => {
        player.addToCity(CardName.CEMETARY);

        expect(gameState.discardPile.length).to.be(0);
        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);

        expect(() => {
          multiStepGameInputTest(gameState, [
            {
              inputType: GameInputType.VISIT_DESTINATION_CARD,
              clientOptions: {
                playedCard: player.getFirstPlayedCard(CardName.CEMETARY),
              },
            },
            {
              inputType: GameInputType.SELECT_OPTION_GENERIC,
              prevInputType: GameInputType.VISIT_DESTINATION_CARD,
              options: ["Deck"],
              cardContext: CardName.CEMETARY,
              clientOptions: {
                selectedOption: "Discard Pile",
              },
            },
          ]);
        }).to.throwException(/unable to draw card from discard/i);
      });
    });

    describe(CardName.CHAPEL, () => {
      it("when player visits, should add a VP and give 2 cards per VP on Chapel", () => {
        let player = gameState.getActivePlayer();
        const card = Card.fromName(CardName.CHAPEL);

        player.addToCity(CardName.CHAPEL);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getFirstPlayedCard(CardName.CHAPEL)).to.eql({
          cardName: CardName.CHAPEL,
          cardOwnerId: player.playerId,
          usedForCritter: false,
          workers: [],
          resources: { [ResourceType.VP]: 0 },
        });

        let chapelInfo = player.getFirstPlayedCard(CardName.CHAPEL);
        let chapelResources = chapelInfo.resources || { [ResourceType.VP]: 0 };
        let numVP = chapelResources[ResourceType.VP] || 0;
        expect(numVP).to.be(0);
        expect(player.cardsInHand.length).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.CHAPEL),
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.cardsInHand.length).to.be(2);

        chapelInfo = player.getFirstPlayedCard(CardName.CHAPEL);
        chapelResources = chapelInfo.resources || { [ResourceType.VP]: 0 };
        numVP = chapelResources[ResourceType.VP] || 0;
        expect(numVP).to.be(1);
      });

      it("should give additional cards when Chapel has already has VP on it", () => {
        let player = gameState.getActivePlayer();
        const card = Card.fromName(CardName.CHAPEL);

        player.addToCity(CardName.CHAPEL);
        let chapelInfo = player.getFirstPlayedCard(CardName.CHAPEL);
        let chapelResources = chapelInfo.resources || { [ResourceType.VP]: 0 };
        chapelResources[ResourceType.VP] = 1;

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getFirstPlayedCard(CardName.CHAPEL)).to.eql({
          cardName: CardName.CHAPEL,
          cardOwnerId: player.playerId,
          usedForCritter: false,
          workers: [],
          resources: { [ResourceType.VP]: 1 },
        });

        let numVP = chapelResources[ResourceType.VP] || 0;
        expect(numVP).to.be(1);
        expect(player.cardsInHand.length).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.CHAPEL),
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.cardsInHand.length).to.be(4);

        chapelInfo = player.getFirstPlayedCard(CardName.CHAPEL);
        chapelResources = chapelInfo.resources || { [ResourceType.VP]: 0 };
        numVP = chapelResources[ResourceType.VP] || 0;
        expect(numVP).to.be(2);
      });
    });

    describe(CardName.CHIP_SWEEP, () => {
      it("should do nothing if only the CHIP_SWEEP is played", () => {
        const card = Card.fromName(CardName.CHIP_SWEEP);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);
        expect(player.hasCardInCity(card.name)).to.be(false);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);

        expect(player.hasCardInCity(card.name)).to.be(true);
      });

      it("should allow the player to select a card to play", () => {
        const card = Card.fromName(CardName.CHIP_SWEEP);

        player.addToCity(CardName.MINE);
        player.addToCity(CardName.FARM);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.CHIP_SWEEP,
            maxToSelect: 1,
            minToSelect: 1,
            cardOptions: [
              ...player.getPlayedCardInfos(CardName.MINE),
              ...player.getPlayedCardInfos(CardName.FARM),
            ],
            clientOptions: {
              selectedCards: player.getPlayedCardInfos(CardName.MINE),
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
      });

      it("should not allow the player to copy their HUSBAND (if they are missing a WIFE AND FARM)", () => {
        const card = Card.fromName(CardName.CHIP_SWEEP);

        player.addToCity(CardName.HUSBAND);
        player.addToCity(CardName.FARM);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);
        expect(player.hasCardInCity(card.name)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.CHIP_SWEEP,
            maxToSelect: 1,
            minToSelect: 1,
            cardOptions: [...player.getPlayedCardInfos(CardName.FARM)],
            clientOptions: {
              selectedCards: player.getPlayedCardInfos(CardName.FARM),
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });
    });

    describe(CardName.CLOCK_TOWER, () => {
      it("should not prompt user to activate CLOCK_TOWER if no applicable workers", () => {
        player.addToCity(CardName.CLOCK_TOWER);
        expect(player.currentSeason).to.be(Season.WINTER);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

        // Use up all workers
        gameState.locationsMap[LocationName.HAVEN] = [
          player.playerId,
          player.playerId,
        ];

        player.placeWorkerOnLocation(LocationName.HAVEN);
        player.placeWorkerOnLocation(LocationName.HAVEN);

        [player, gameState] = multiStepGameInputTest(gameState, [
          { inputType: GameInputType.PREPARE_FOR_SEASON },
        ]);

        expect(player.getFirstPlayedCard(CardName.CLOCK_TOWER)).to.eql({
          cardName: CardName.CLOCK_TOWER,
          cardOwnerId: player.playerId,
          resources: {
            [ResourceType.VP]: 3,
          },
          usedForCritter: false,
        });
      });

      it("should prompt user to activate CLOCK_TOWER before recalling workers", () => {
        player.addToCity(CardName.CLOCK_TOWER);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.MINE);
        player.addToCity(CardName.MINE);
        expect(player.currentSeason).to.be(Season.WINTER);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

        // Use up all workers
        gameState.locationsMap[LocationName.FOREST_TWO_WILD] = [
          player.playerId,
        ];
        gameState.locationsMap[LocationName.BASIC_ONE_BERRY]!.push(
          player.playerId
        );
        player.placeWorkerOnLocation(LocationName.BASIC_ONE_BERRY);
        player.placeWorkerOnLocation(LocationName.FOREST_TWO_WILD);

        const [playerNoActivate, gameStateNoActivate] = multiStepGameInputTest(
          gameState,
          [
            {
              inputType: GameInputType.PREPARE_FOR_SEASON,
            },
            {
              cardContext: CardName.CLOCK_TOWER,
              inputType: GameInputType.SELECT_WORKER_PLACEMENT,
              mustSelectOne: false,
              options: [
                {
                  location: LocationName.BASIC_ONE_BERRY,
                },
                {
                  location: LocationName.FOREST_TWO_WILD,
                },
              ],
              clientOptions: {
                selectedOption: null,
              },
              prevInputType: GameInputType.PREPARE_FOR_SEASON,
            },
          ]
        );
        expect(
          playerNoActivate.getNumResourcesByType(ResourceType.BERRY)
        ).to.be(2);
        expect(
          playerNoActivate.getNumResourcesByType(ResourceType.PEBBLE)
        ).to.be(2);
        expect(playerNoActivate.numAvailableWorkers).to.be(3);
        expect(
          playerNoActivate.getPlayedCardInfos(CardName.CLOCK_TOWER)?.[0]
        ).to.eql({
          cardName: CardName.CLOCK_TOWER,
          cardOwnerId: playerNoActivate.playerId,
          resources: {
            [ResourceType.VP]: 3,
          },
          usedForCritter: false,
        });

        const [
          playerWithActivate,
          gameStateWithActivate,
        ] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.PREPARE_FOR_SEASON,
          },
          {
            cardContext: CardName.CLOCK_TOWER,
            inputType: GameInputType.SELECT_WORKER_PLACEMENT,
            mustSelectOne: false,
            options: [
              {
                location: LocationName.BASIC_ONE_BERRY,
              },
              {
                location: LocationName.FOREST_TWO_WILD,
              },
            ],
            clientOptions: {
              selectedOption: {
                location: LocationName.FOREST_TWO_WILD,
              },
            },
            prevInputType: GameInputType.PREPARE_FOR_SEASON,
          },
          {
            inputType: GameInputType.SELECT_RESOURCES,
            toSpend: false,
            prevInputType: GameInputType.PLACE_WORKER,
            locationContext: LocationName.FOREST_TWO_WILD,
            maxResources: 2,
            minResources: 2,
            clientOptions: {
              resources: {
                [ResourceType.BERRY]: 2,
              },
            },
          },
        ]);
        expect(
          playerWithActivate.getNumResourcesByType(ResourceType.BERRY)
        ).to.be(4);
        expect(
          playerWithActivate.getNumResourcesByType(ResourceType.PEBBLE)
        ).to.be(2);
        expect(playerWithActivate.numAvailableWorkers).to.be(3);
        expect(
          playerWithActivate.getPlayedCardInfos(CardName.CLOCK_TOWER)?.[0]
        ).to.eql({
          cardName: CardName.CLOCK_TOWER,
          cardOwnerId: playerWithActivate.playerId,
          resources: {
            [ResourceType.VP]: 2,
          },
          usedForCritter: false,
        });
      });

      it("should with multiple multi-step productions", () => {
        player.addToCity(CardName.CLOCK_TOWER);
        player.addToCity(CardName.TEACHER);
        player.addToCity(CardName.CHIP_SWEEP);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.HUSBAND);
        player.addToCity(CardName.WIFE);
        expect(player.currentSeason).to.be(Season.WINTER);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

        // Use up all workers
        gameState.locationsMap[LocationName.BASIC_ONE_BERRY]!.push(
          player.playerId,
          player.playerId
        );
        player.placeWorkerOnLocation(LocationName.BASIC_ONE_BERRY);
        player.placeWorkerOnLocation(LocationName.BASIC_ONE_BERRY);

        let intermediateGameState = gameState.next({
          inputType: GameInputType.PREPARE_FOR_SEASON,
        });

        const clockTowerInput = {
          cardContext: CardName.CLOCK_TOWER,
          inputType: GameInputType.SELECT_WORKER_PLACEMENT as const,
          prevInputType: GameInputType.PREPARE_FOR_SEASON,
          mustSelectOne: false,
          options: [
            {
              location: LocationName.BASIC_ONE_BERRY,
            },
            {
              location: LocationName.BASIC_ONE_BERRY,
            },
          ],
          clientOptions: {
            selectedOption: {
              location: LocationName.BASIC_ONE_BERRY,
            },
          },
        };

        const husbandInput = {
          inputType: GameInputType.SELECT_OPTION_GENERIC as const,
          prevInputType: GameInputType.SELECT_WORKER_PLACEMENT,
          cardContext: CardName.HUSBAND,
          options: [
            ResourceType.BERRY,
            ResourceType.TWIG,
            ResourceType.RESIN,
            ResourceType.PEBBLE,
          ],
          clientOptions: {
            selectedOption: ResourceType.BERRY,
          },
        };

        const chipSweepInput = {
          inputType: GameInputType.SELECT_PLAYED_CARDS as const,
          prevInputType: GameInputType.SELECT_WORKER_PLACEMENT,
          cardContext: CardName.CHIP_SWEEP,
          maxToSelect: 1,
          minToSelect: 1,
          cardOptions: [
            ...player.getPlayedCardInfos(CardName.TEACHER),
            ...player.getPlayedCardInfos(CardName.FARM),
            ...player.getPlayedCardInfos(CardName.HUSBAND),
          ],
          clientOptions: {
            selectedCards: player.getPlayedCardInfos(CardName.FARM),
          },
        };

        const teacherInput = {
          inputType: GameInputType.SELECT_CARDS as const,
          prevInputType: GameInputType.SELECT_WORKER_PLACEMENT,
          cardContext: CardName.TEACHER,
          cardOptions: [CardName.TEACHER, CardName.TEACHER],
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: [CardName.TEACHER],
          },
        };

        const teacherSelectPlayerInput = {
          inputType: GameInputType.SELECT_PLAYER as const,
          prevInputType: GameInputType.SELECT_CARDS,
          prevInput: teacherInput,
          cardContext: CardName.TEACHER,
          playerOptions: [gameState.players[1].playerId],
          mustSelectOne: true,
          clientOptions: {
            selectedPlayer: gameState.players[1].playerId,
          },
        };
        intermediateGameState = intermediateGameState.next(clockTowerInput);
        intermediateGameState = intermediateGameState.next(husbandInput);
        intermediateGameState = intermediateGameState.next(chipSweepInput);
        intermediateGameState = intermediateGameState.next(
          teacherInput,
          false /* autoAdvance */
        );
        intermediateGameState = intermediateGameState.next(
          teacherSelectPlayerInput,
          false /* autoAdvance */
        );

        player = intermediateGameState.getPlayer(player.playerId);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(4);
        expect(player.numAvailableWorkers).to.be(3);
        expect(player.cardsInHand).to.eql([CardName.TEACHER]);
        expect(player.getPlayedCardInfos(CardName.CLOCK_TOWER)?.[0]).to.eql({
          cardName: CardName.CLOCK_TOWER,
          cardOwnerId: player.playerId,
          resources: {
            [ResourceType.VP]: 2,
          },
          usedForCritter: false,
        });
      });
    });

    describe(CardName.COURTHOUSE, () => {
      it("should do nothing is player plays a critter", () => {
        player.addToCity(CardName.COURTHOUSE);

        const cardToPlay = Card.fromName(CardName.HUSBAND);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);
        multiStepGameInputTest(gameState, [playCardInput(cardToPlay.name)]);
      });

      it("should ask to gain a non berry resource after a construction is played", () => {
        player.addToCity(CardName.COURTHOUSE);

        const cardToPlay = Card.fromName(CardName.FARM);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.COURTHOUSE,
            options: ["TWIG", "RESIN", "PEBBLE"],
            clientOptions: {
              selectedOption: "PEBBLE",
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });
    });

    describe(CardName.CRANE, () => {
      it("should make constructions 3 cheaper", () => {
        player.addToCity(CardName.CRANE);
        player.cardsInHand.push(CardName.FARM);

        expect(() => {
          multiStepGameInputTest(gameState, [playCardInput(CardName.FARM)]);
        }).to.throwException(/can't spend/i);

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(CardName.FARM, {
              paymentOptions: {
                resources: {
                  [ResourceType.TWIG]: 0,
                  [ResourceType.RESIN]: 0,
                },
              },
            }),
          ]);
        }).to.throwException(/insufficient/i);

        expect(player.hasCardInCity(CardName.CRANE)).to.be(true);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(CardName.FARM, {
            paymentOptions: {
              cardToUse: CardName.CRANE,
              resources: {
                [ResourceType.TWIG]: 0,
                [ResourceType.RESIN]: 0,
              },
            },
          }),
        ]);

        expect(player.hasCardInCity(CardName.CRANE)).to.be(false);
        expect(player.hasCardInCity(CardName.FARM)).to.be(true);
      });

      it("cannot be used for critters", () => {
        player.addToCity(CardName.CRANE);
        player.cardsInHand.push(CardName.WIFE);

        expect(() => {
          multiStepGameInputTest(gameState, [playCardInput(CardName.WIFE)]);
        }).to.throwException(/can't spend/i);

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(CardName.WIFE, {
              paymentOptions: {
                resources: { [ResourceType.BERRY]: 0 },
              },
            }),
          ]);
        }).to.throwException(/insufficient/i);

        expect(player.hasCardInCity(CardName.CRANE)).to.be(true);

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(CardName.WIFE, {
              paymentOptions: {
                cardToUse: CardName.CRANE,
                resources: { [ResourceType.BERRY]: 0 },
              },
            }),
          ]);
        }).to.throwException(/not a construction/i);
      });
    });

    describe(CardName.DOCTOR, () => {
      it("should not prompt player if they don't have any berries", () => {
        const card = Card.fromName(CardName.DOCTOR);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.addCardToHand(gameState, card.name);
        [player, gameState] = multiStepGameInputTest(
          gameState,
          [playCardInput(card.name)],
          {
            autoAdvance: true,
          }
        );

        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      });

      it("should allow player to pay up to 3 berries for vp", () => {
        const card = Card.fromName(CardName.DOCTOR);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        // Make sure we can spend for vp
        player.gainResources({ [ResourceType.BERRY]: 3 });
        player.addCardToHand(gameState, card.name);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_RESOURCES,
            toSpend: true,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.DOCTOR,
            specificResource: ResourceType.BERRY,
            minResources: 0,
            maxResources: 3,
            clientOptions: {
              resources: {
                [ResourceType.BERRY]: 3,
              },
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(3);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      });
    });

    describe(CardName.DUNGEON, () => {
      it("should allow players to play a card even if city is full", () => {
        const card = Card.fromName(CardName.DUNGEON);
        player.addToCity(card.name);
        player.cardsInHand.push(CardName.FARM);
        for (let i = 0; i < 14; i++) {
          player.addToCity(CardName.HUSBAND);
        }
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(CardName.FARM, {
            paymentOptions: {
              resources: {
                [ResourceType.TWIG]: 0,
                [ResourceType.RESIN]: 0,
              },
              cardToDungeon: CardName.HUSBAND,
            },
          }),
        ]);
      });

      it("should NOT allow players to use DUNGEON with WANDERER if city is full", () => {
        const card = Card.fromName(CardName.DUNGEON);
        player.addToCity(card.name);
        player.cardsInHand.push(CardName.FARM);
        for (let i = 0; i < 14; i++) {
          player.addToCity(CardName.HUSBAND);
        }
        player.addToCity(CardName.WANDERER);
        expect(() => {
          [player, gameState] = multiStepGameInputTest(gameState, [
            playCardInput(CardName.FARM, {
              paymentOptions: {
                resources: {
                  [ResourceType.TWIG]: 0,
                  [ResourceType.RESIN]: 0,
                },
                cardToDungeon: CardName.WANDERER,
              },
            }),
          ]);
        }).to.throwException(/unable to add Farm/i);
      });
    });

    describe(CardName.EVERTREE, () => {
      it("should be worth 1 extra point per purple card", () => {
        player.addToCity(CardName.EVERTREE);

        const card = Card.fromName(CardName.EVERTREE);
        const playerId = player.playerId;

        expect(card.getPoints(gameState, playerId)).to.be(5 + 1);

        player.addToCity(CardName.WIFE);
        expect(card.getPoints(gameState, playerId)).to.be(5 + 2);

        player.addToCity(CardName.PALACE);
        expect(card.getPoints(gameState, playerId)).to.be(5 + 3);

        player.addToCity(CardName.UNIVERSITY);
        expect(card.getPoints(gameState, playerId)).to.be(5 + 3);
      });
    });

    describe(CardName.FAIRGROUNDS, () => {
      it("draws player 2 CARD when played", () => {
        const card = Card.fromName(CardName.FAIRGROUNDS);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.addCardToHand(gameState, card.name);

        expect(player.cardsInHand.length).to.be(1);
        expect(player.hasCardInCity(card.name)).to.be(false);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);
        expect(player.cardsInHand.length).to.be(2);
        expect(player.hasCardInCity(card.name)).to.be(true);
      });
    });

    describe(CardName.FARM, () => {
      it("should have card to play it", () => {
        const card = Card.fromName(CardName.FARM);
        const gameInput = playCardInput(card.name);
        player.gainResources(card.baseCost);

        player.cardsInHand = [];
        expect(card.canPlay(gameState, gameInput)).to.be(false);
        player.cardsInHand = [card.name];
        expect(card.canPlay(gameState, gameInput)).to.be(true);
      });

      it("should remove card from hand after playing it", () => {
        const card = Card.fromName(CardName.FARM);
        const gameInput = playCardInput(card.name);
        player.gainResources(card.baseCost);

        player.cardsInHand = [];
        expect(card.canPlay(gameState, gameInput)).to.be(false);
        player.cardsInHand = [card.name];
        expect(card.canPlay(gameState, gameInput)).to.be(true);

        expect(player.cardsInHand).to.not.eql([]);
        [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);
        expect(player.cardsInHand).to.eql([]);
      });

      it("should spend resources after playing it", () => {
        const card = Card.fromName(CardName.FARM);
        const gameInput = playCardInput(card.name);

        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(1);

        player.cardsInHand = [card.name];
        expect(card.canPlay(gameState, gameInput)).to.be(true);

        [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);

        expect(player.cardsInHand).to.eql([]);
        expect(player.hasCardInCity(CardName.FARM)).to.be(true);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);
      });

      it("should gain 1 berry when played", () => {
        const card = Card.fromName(CardName.FARM);
        const gameInput = playCardInput(card.name);

        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });
    });

    describe(CardName.FOOL, () => {
      it("should allow the player to select player to target", () => {
        const targetPlayerId = gameState.players[1].playerId;
        const card = Card.fromName(CardName.FOOL);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.FOOL,
            mustSelectOne: true,
            playerOptions: [targetPlayerId],
            clientOptions: {
              selectedPlayer: targetPlayerId,
            },
          },
        ]);

        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(
          gameState.getPlayer(targetPlayerId).hasCardInCity(card.name)
        ).to.be(true);
      });

      it("should auto advance player selection if only 1 option", () => {
        const targetPlayerId = gameState.players[1].playerId;
        const card = Card.fromName(CardName.FOOL);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        [player, gameState] = multiStepGameInputTest(
          gameState,
          [playCardInput(card.name)],
          { autoAdvance: true }
        );

        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(
          gameState.getPlayer(targetPlayerId).hasCardInCity(card.name)
        ).to.be(true);
      });

      it("should not allow the player to select player with no available city spaces", () => {
        gameState = testInitialGameState({ numPlayers: 3 });
        const player = gameState.getActivePlayer();
        const targetPlayerId = gameState.players[1].playerId;
        const targetPlayer = gameState.getPlayer(targetPlayerId);
        const player3 = gameState.players[2].playerId;
        const card = Card.fromName(CardName.FOOL);

        targetPlayer.addToCityMulti([
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
        ]);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        gameState = gameState.next(
          playCardInput(card.name),
          false /* autoAdvance */
        );

        expect(() => {
          gameState.next({
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.FOOL,
            mustSelectOne: true,
            playerOptions: [targetPlayerId, player3],
            clientOptions: {
              selectedPlayer: targetPlayerId,
            },
          });
        }).to.throwException(/invalid/i);
      });

      it("should not allow the player to select player who already has a FOOL in city", () => {
        gameState = testInitialGameState({ numPlayers: 3 });
        const player = gameState.getActivePlayer();
        const targetPlayerId = gameState.players[1].playerId;
        const targetPlayer = gameState.getPlayer(targetPlayerId);
        const player3 = gameState.players[2].playerId;
        const card = Card.fromName(CardName.FOOL);

        targetPlayer.addToCity(card.name);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        gameState = gameState.next(
          playCardInput(card.name),
          false /* autoAdvance */
        );

        expect(() => {
          gameState.next({
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.FOOL,
            mustSelectOne: true,
            playerOptions: [targetPlayerId, player3],
            clientOptions: {
              selectedPlayer: targetPlayerId,
            },
          });
        }).to.throwException(/invalid/i);
      });
    });

    describe(CardName.GENERAL_STORE, () => {
      it("should gain 1 berry when played (w/o farm)", () => {
        const card = Card.fromName(CardName.GENERAL_STORE);
        const gameInput = playCardInput(card.name);

        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });

      it("should gain 2 berries when played (w farm)", () => {
        const card = Card.fromName(CardName.GENERAL_STORE);
        const gameInput = playCardInput(card.name);

        player.addToCity(CardName.FARM);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
      });
    });

    describe(CardName.HISTORIAN, () => {
      it("should draw a card if player plays a construction", () => {
        player.addToCity(CardName.HISTORIAN);

        const cardToPlay = Card.fromName(CardName.MINE);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);

        gameState.deck.addToStack(CardName.KING);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
        ]);

        expect(player.cardsInHand).to.eql([CardName.KING]);
      });

      it("should draw a card if player plays a critter", () => {
        player.addToCity(CardName.HISTORIAN);

        const cardToPlay = Card.fromName(CardName.SHOPKEEPER);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);

        gameState.deck.addToStack(CardName.KING);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
        ]);

        expect(player.cardsInHand).to.eql([CardName.KING]);
      });

      it("should not draw a card when the player plays the historian", () => {
        const cardToPlay = Card.fromName(CardName.HISTORIAN);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
        ]);
        expect(player.cardsInHand).to.eql([]);
      });
    });

    describe(CardName.HUSBAND, () => {
      it("should do nothing if there's no available wife", () => {
        const card = Card.fromName(CardName.HUSBAND);
        // Add husband & wife to city
        player.addToCity(CardName.WIFE);
        player.addToCity(CardName.HUSBAND);

        player.cardsInHand = [CardName.HUSBAND];
        player.gainResources(card.baseCost);
        multiStepGameInputTest(gameState, [playCardInput(card.name)]);
      });

      it("should gain a wild resource if there's a available wife and farm in city", () => {
        const card = Card.fromName(CardName.HUSBAND);

        player.cardsInHand = [CardName.HUSBAND];
        player.addToCity(CardName.WIFE);
        player.addToCity(CardName.FARM);
        player.gainResources(card.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.HUSBAND,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.BERRY,
            },
          },
        ]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });
    });

    describe(CardName.INN, () => {
      it("should allow player buy card from meadow without spending resources if cost is <= 3", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.MONK,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        gameState.deck.addToStack(CardName.WIFE);

        const idx = gameState.meadowCards.indexOf(CardName.WIFE);
        expect(idx).to.be(-1);

        let player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.INN);

        player.addToCity(CardName.INN);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getFirstPlayedCard(CardName.INN)).to.eql({
          cardName: CardName.INN,
          cardOwnerId: player.playerId,
          usedForCritter: false,
          workers: [],
        });
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.INN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.INN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.MONK,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.FARM],
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.FARM)).to.be(true);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);

        const wifeInMeadow = gameState.meadowCards.indexOf(CardName.WIFE) >= 0;
        expect(wifeInMeadow).to.be(true);
      });

      it("should allow player buy card from meadow if cost is > 3", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.MONK,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        gameState.deck.addToStack(CardName.RANGER);

        const idx = gameState.meadowCards.indexOf(CardName.RANGER);
        expect(idx).to.be(-1);

        let player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.INN);

        // Make sure we can play this card
        player.gainResources({ [ResourceType.BERRY]: 4 });
        player.addToCity(CardName.INN);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(4);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.INN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.INN,
            cardOptions: [
              CardName.KING,
              CardName.QUEEN,
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.MONK,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.QUEEN],
            },
          },
          {
            inputType: GameInputType.SELECT_PAYMENT_FOR_CARD,
            prevInputType: GameInputType.SELECT_CARDS,
            cardContext: card.name,
            card: CardName.QUEEN,
            clientOptions: {
              card: CardName.QUEEN,
              paymentOptions: {
                resources: {
                  [ResourceType.BERRY]: 2,
                },
                cardToUse: CardName.INN,
              },
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(true);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);

        const rangerInMeadow =
          gameState.meadowCards.indexOf(CardName.RANGER) >= 0;
        expect(rangerInMeadow).to.be(true);
      });

      it("should not allow player to buy unplayable card from meadow", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.MONK,
        ];

        gameState = testInitialGameState({ meadowCards: cards });
        const player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.INN);

        // Make sure we can play this card
        player.gainResources({ [ResourceType.BERRY]: 4 });
        player.addToCity(CardName.INN);
        // Already have QUEEN & KING in city.
        player.addToCity(CardName.QUEEN);
        player.addToCity(CardName.KING);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(4);

        expect(() => {
          multiStepGameInputTest(gameState, [
            {
              inputType: GameInputType.VISIT_DESTINATION_CARD,
              clientOptions: {
                playedCard: player.getFirstPlayedCard(CardName.INN),
              },
            },
            {
              inputType: GameInputType.SELECT_CARDS,
              prevInputType: GameInputType.VISIT_DESTINATION_CARD,
              cardContext: CardName.INN,
              cardOptions: [
                CardName.POSTAL_PIGEON,
                CardName.POSTAL_PIGEON,
                CardName.FARM,
                CardName.HUSBAND,
                CardName.MONK,
              ],
              maxToSelect: 1,
              minToSelect: 1,
              clientOptions: {
                selectedCards: [CardName.QUEEN],
              },
            },
          ]);
        }).to.throwException(/unable to add queen to city/i);
      });

      it("should allow player buy card using another player's inn", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.MONK,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        gameState.deck.addToStack(CardName.DOCTOR);

        const idx = gameState.meadowCards.indexOf(CardName.DOCTOR);
        expect(idx).to.be(-1);

        let player = gameState.getActivePlayer();
        const player2 = gameState.players[1];

        const card = Card.fromName(CardName.INN);

        player2.addToCity(CardName.INN);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.QUEEN)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player2.getFirstPlayedCard(CardName.INN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.INN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.MONK,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.FARM],
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.FARM)).to.be(true);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);

        const doctorInMeadow =
          gameState.meadowCards.indexOf(CardName.DOCTOR) >= 0;
        expect(doctorInMeadow).to.be(true);
      });

      it("should not allow player buy card in hand but not in meadow", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.MONK,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        const player = gameState.getActivePlayer();

        // Make sure we can play this card
        player.cardsInHand.push(CardName.WIFE);
        player.addToCity(CardName.INN);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.WIFE)).to.be(false);

        gameState = gameState.next({
          inputType: GameInputType.VISIT_DESTINATION_CARD,
          clientOptions: {
            playedCard: player.getFirstPlayedCard(CardName.INN),
          },
        });

        expect(() => {
          gameState.next({
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.INN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.MONK,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.WIFE],
            },
          });
        }).to.throwException(/cannot find selected card/i);
      });

      it("should allow player to buy card that exists in hand and meadow", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.WIFE,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        let player = gameState.getActivePlayer();
        gameState.deck.addToStack(CardName.LOOKOUT);

        const idx = gameState.meadowCards.indexOf(CardName.LOOKOUT);
        expect(idx).to.be(-1);

        player.addToCity(CardName.INN);
        player.cardsInHand.push(CardName.WIFE);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.WIFE)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.INN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.INN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.WIFE,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.WIFE],
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.WIFE)).to.be(true);

        const hasWifeInHand = player.cardsInHand.indexOf(CardName.WIFE) >= 0;
        expect(hasWifeInHand).to.be(true);

        const wifeInMeadow = gameState.meadowCards.indexOf(CardName.WIFE) >= 0;
        expect(wifeInMeadow).to.be(false);

        const lookoutInMeadow =
          gameState.meadowCards.indexOf(CardName.LOOKOUT) >= 0;
        expect(lookoutInMeadow).to.be(true);
      });
    });

    describe(CardName.INNKEEPER, () => {
      it("can be used to play a critter for 3 BERRY less", () => {
        const card = Card.fromName(CardName.WIFE);
        player.addToCity(CardName.INNKEEPER);
        player.cardsInHand.push(card.name);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(true);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name, {
            paymentOptions: {
              resources: { [ResourceType.BERRY]: 0 },
              cardToUse: CardName.INNKEEPER,
            },
          }),
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(false);
      });

      it("can be used to play a critter even if city is full", () => {
        const card = Card.fromName(CardName.WIFE);
        player.addToCity(CardName.INNKEEPER);
        player.cardsInHand.push(card.name);

        for (let i = 0; i < 14; i++) {
          player.addToCity(CardName.FARM);
        }

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumOccupiedSpacesInCity()).to.be(15);
        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(true);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name, {
            paymentOptions: {
              resources: { [ResourceType.BERRY]: 0 },
              cardToUse: CardName.INNKEEPER,
            },
          }),
        ]);

        expect(player.getNumOccupiedSpacesInCity()).to.be(15);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(false);
      });

      it("can be used to play a critter that cost more then 3 BERRY", () => {
        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.INNKEEPER);
        player.cardsInHand.push(card.name);
        player.gainResources({ [ResourceType.BERRY]: 2 });

        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(true);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name, {
            paymentOptions: {
              resources: { [ResourceType.BERRY]: 2 },
              cardToUse: CardName.INNKEEPER,
            },
          }),
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(false);
      });

      it("cannot be used to play a construction", () => {
        const card = Card.fromName(CardName.FARM);
        player.addToCity(CardName.INNKEEPER);
        player.cardsInHand.push(card.name);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);

        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.INNKEEPER)).to.be(true);

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(card.name, {
              paymentOptions: {
                resources: {
                  [ResourceType.TWIG]: 0,
                  [ResourceType.RESIN]: 0,
                },
                cardToUse: CardName.INNKEEPER,
              },
            }),
          ]);
        }).to.throwException(/not a critter/i);
      });
    });

    xdescribe(CardName.JUDGE, () => {
      it("should have tests", () => {});
    });

    describe(CardName.KING, () => {
      it("should calculate the points correctly", () => {
        const card = Card.fromName(CardName.KING);
        expect(card.getPoints(gameState, player.playerId)).to.be(4);

        player.placeWorkerOnEvent(EventName.BASIC_FOUR_PRODUCTION);
        expect(card.getPoints(gameState, player.playerId)).to.be(4 + 1);

        player.placeWorkerOnEvent(EventName.SPECIAL_GRADUATION_OF_SCHOLARS);
        expect(card.getPoints(gameState, player.playerId)).to.be(4 + 1 + 2);
      });
    });

    describe(CardName.LOOKOUT, () => {
      it("should allow player to copy a basic location", () => {
        let player1 = gameState.getActivePlayer();
        player1.addToCity(CardName.LOOKOUT);

        expect(player1.numAvailableWorkers).to.be(2);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        // All cards player can't play
        expect(gameState.meadowCards).to.eql([]);
        gameState.meadowCards.push(CardName.LOOKOUT);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player1.getFirstPlayedCard(CardName.LOOKOUT),
            },
          },
          {
            inputType: GameInputType.SELECT_LOCATION,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.LOOKOUT,
            locationOptions: gameState
              .getPlayableLocations({
                checkCanPlaceWorker: false,
              })
              .filter((name) => {
                const location = Location.fromName(name);
                return (
                  location.type === LocationType.BASIC ||
                  location.type === LocationType.FOREST
                );
              }),
            clientOptions: {
              selectedLocation: LocationName.BASIC_ONE_BERRY,
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);

        expect(player1.numAvailableWorkers).to.be(1);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });

      it("should allow player to copy a forest location", () => {
        gameState.locationsMap[LocationName.FOREST_TWO_BERRY_ONE_CARD] = [];
        let player1 = gameState.getActivePlayer();
        player1.addToCity(CardName.LOOKOUT);

        expect(player1.numAvailableWorkers).to.be(2);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player1.cardsInHand.length).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player1.getFirstPlayedCard(CardName.LOOKOUT),
            },
          },
          {
            inputType: GameInputType.SELECT_LOCATION,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.LOOKOUT,
            locationOptions: gameState
              .getPlayableLocations({
                checkCanPlaceWorker: false,
              })
              .filter((name) => {
                const location = Location.fromName(name);
                return (
                  location.type === LocationType.BASIC ||
                  location.type === LocationType.FOREST
                );
              }),
            clientOptions: {
              selectedLocation: LocationName.FOREST_TWO_BERRY_ONE_CARD,
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);

        expect(player1.numAvailableWorkers).to.be(1);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        expect(player1.cardsInHand.length).to.be(1);
      });

      it("should only allow player to copy a playable forest location", () => {
        // simulate player not being able to visit this location:
        gameState.locationsMap[
          LocationName.FOREST_DRAW_TWO_MEADOW_PLAY_ONE_FOR_ONE_LESS
        ] = [];
        gameState.locationsMap[
          LocationName.FOREST_DISCARD_ANY_THEN_DRAW_TWO_PER_CARD
        ] = [];

        const player1 = gameState.getActivePlayer();

        // Use first worker
        gameState.locationsMap[LocationName.BASIC_TWO_CARDS_AND_ONE_VP] = [
          player1.playerId,
        ];
        player1.placeWorkerOnLocation(LocationName.BASIC_TWO_CARDS_AND_ONE_VP);

        player1.addToCity(CardName.LOOKOUT);

        expect(player1.numAvailableWorkers).to.be(1);
        expect(player1.cardsInHand.length).to.be(0);

        expect(() => {
          multiStepGameInputTest(gameState, [
            {
              inputType: GameInputType.VISIT_DESTINATION_CARD,
              clientOptions: {
                playedCard: player1.getFirstPlayedCard(CardName.LOOKOUT),
              },
            },
            {
              inputType: GameInputType.SELECT_LOCATION,
              prevInputType: GameInputType.VISIT_DESTINATION_CARD,
              cardContext: CardName.LOOKOUT,
              locationOptions: gameState
                .getPlayableLocations({
                  checkCanPlaceWorker: false,
                })
                .filter((name) => {
                  const location = Location.fromName(name);
                  return (
                    location.type === LocationType.BASIC ||
                    location.type === LocationType.FOREST
                  );
                }),
              clientOptions: {
                selectedLocation:
                  LocationName.FOREST_DRAW_TWO_MEADOW_PLAY_ONE_FOR_ONE_LESS,
              },
            },
          ]);
        }).to.throwException(/invalid location selected/i);
      });

      it("should allow player to copy FOREST_DISCARD_ANY_THEN_DRAW_TWO_PER_CARD", () => {
        gameState.locationsMap[
          LocationName.FOREST_DISCARD_ANY_THEN_DRAW_TWO_PER_CARD
        ] = [];
        let player1 = gameState.getActivePlayer();
        player1.addToCity(CardName.LOOKOUT);
        player1.cardsInHand = [
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
        ];
        gameState.locationsMap[LocationName.BASIC_TWO_CARDS_AND_ONE_VP] = [
          player1.playerId,
        ];
        player1.placeWorkerOnLocation(LocationName.BASIC_TWO_CARDS_AND_ONE_VP);

        expect(player1.numAvailableWorkers).to.be(1);
        expect(player1.cardsInHand.length).to.be(4);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player1.getFirstPlayedCard(CardName.LOOKOUT),
            },
          },
          {
            inputType: GameInputType.SELECT_LOCATION,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.LOOKOUT,
            locationOptions: gameState
              .getPlayableLocations({
                checkCanPlaceWorker: false,
              })
              .filter((name) => {
                const location = Location.fromName(name);
                return (
                  location.type === LocationType.BASIC ||
                  location.type === LocationType.FOREST
                );
              }),
            clientOptions: {
              selectedLocation:
                LocationName.FOREST_DISCARD_ANY_THEN_DRAW_TWO_PER_CARD,
            },
          },
          {
            inputType: GameInputType.DISCARD_CARDS,
            prevInputType: GameInputType.PLACE_WORKER,
            locationContext:
              LocationName.FOREST_DISCARD_ANY_THEN_DRAW_TWO_PER_CARD,
            minCards: 0,
            maxCards: 8,
            clientOptions: {
              cardsToDiscard: [
                CardName.FARM,
                CardName.FARM,
                CardName.FARM,
                CardName.FARM,
              ],
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);

        expect(player1.numAvailableWorkers).to.be(0);
        expect(player1.cardsInHand.length).to.be(8);
      });

      it("should allow player to copy location with a worker on it", () => {
        gameState.locationsMap[LocationName.FOREST_TWO_BERRY_ONE_CARD] = [];
        let player1 = gameState.getActivePlayer();
        player1.addToCity(CardName.LOOKOUT);

        expect(player1.numAvailableWorkers).to.be(2);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player1.cardsInHand.length).to.be(0);

        // note: placeWorkerOnLocation doesn't gain the placement bonus
        player1.placeWorkerOnLocation(LocationName.FOREST_TWO_BERRY_ONE_CARD);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player1.getFirstPlayedCard(CardName.LOOKOUT),
            },
          },
          {
            inputType: GameInputType.SELECT_LOCATION,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.LOOKOUT,
            locationOptions: gameState
              .getPlayableLocations({
                checkCanPlaceWorker: false,
              })
              .filter((name) => {
                const location = Location.fromName(name);
                return (
                  location.type === LocationType.BASIC ||
                  location.type === LocationType.FOREST
                );
              }),
            clientOptions: {
              selectedLocation: LocationName.FOREST_TWO_BERRY_ONE_CARD,
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);

        expect(player1.numAvailableWorkers).to.be(0);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        expect(player1.cardsInHand.length).to.be(1);
      });
    });

    describe(CardName.MINE, () => {
      it("gain 1 PEBBLE when played", () => {
        const card = Card.fromName(CardName.MINE);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);

        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
        expect(player.hasCardInCity(card.name)).to.be(true);
      });
    });

    describe(CardName.MINER_MOLE, () => {
      it("should allow the player to copy another player's GENERAL_STORE", () => {
        const card = Card.fromName(CardName.MINER_MOLE);

        let player1 = gameState.getActivePlayer();
        const player2 = gameState.players[1];

        player2.addToCity(CardName.GENERAL_STORE);
        player2.addToCity(CardName.FARM);

        // Make sure we can play this card
        player1.gainResources(card.baseCost);
        player1.cardsInHand.push(card.name);

        expect(player1.hasCardInCity(card.name)).to.be(false);

        [player1, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.MINER_MOLE,
            maxToSelect: 1,
            minToSelect: 1,
            cardOptions: [
              ...player2.getPlayedCardInfos(CardName.GENERAL_STORE),
              ...player2.getPlayedCardInfos(CardName.FARM),
            ],
            clientOptions: {
              selectedCards: player2.getPlayedCardInfos(CardName.GENERAL_STORE),
            },
          },
        ]);

        // 2 berries because player 2 has a farm
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
      });

      it("should allow the player to copy another player's HUSBAND", () => {
        const card = Card.fromName(CardName.MINER_MOLE);

        let player1 = gameState.getActivePlayer();
        const player2 = gameState.players[1];

        player2.addToCity(CardName.HUSBAND);
        player2.addToCity(CardName.WIFE);
        player2.addToCity(CardName.FARM);

        // Make sure we can play this card
        player1.gainResources(card.baseCost);
        player1.cardsInHand.push(card.name);

        expect(player1.hasCardInCity(card.name)).to.be(false);

        [player1, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.MINER_MOLE,
            maxToSelect: 1,
            minToSelect: 1,
            cardOptions: [
              ...player2.getPlayedCardInfos(CardName.HUSBAND),
              ...player2.getPlayedCardInfos(CardName.FARM),
            ],
            clientOptions: {
              selectedCards: player2.getPlayedCardInfos(CardName.HUSBAND),
            },
          },
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.SELECT_PLAYED_CARDS,
            cardContext: CardName.HUSBAND,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.BERRY,
            },
          },
        ]);

        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });

      it("should not allow the player to copy another player's HUSBAND (if they are missing a WIFE AND FARM)", () => {
        const card = Card.fromName(CardName.MINER_MOLE);

        let player1 = gameState.getActivePlayer();
        const player2 = gameState.players[1];

        player2.addToCity(CardName.HUSBAND);
        player2.addToCity(CardName.FARM);

        // Make sure we can play this card
        player1.gainResources(card.baseCost);
        player1.cardsInHand.push(card.name);

        expect(player1.hasCardInCity(card.name)).to.be(false);

        [player1, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.MINER_MOLE,
            maxToSelect: 1,
            minToSelect: 1,
            cardOptions: [...player2.getPlayedCardInfos(CardName.FARM)],
            clientOptions: {
              selectedCards: player2.getPlayedCardInfos(CardName.FARM),
            },
          },
        ]);

        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });

      it("should allow the player to copy another player's miner mole", () => {
        const card = Card.fromName(CardName.MINER_MOLE);

        let player1 = gameState.getActivePlayer();
        const player2 = gameState.players[1];

        player1.addToCity(CardName.FARM);
        player1.addToCity(CardName.CHIP_SWEEP);
        player1.addToCity(CardName.GENERAL_STORE);

        player2.addToCity(CardName.MINER_MOLE);
        player2.addToCity(CardName.CHIP_SWEEP);
        player2.addToCity(CardName.GENERAL_STORE);

        // Make sure we can play this card
        player1.gainResources(card.baseCost);
        player1.cardsInHand.push(card.name);

        expect(player1.hasCardInCity(card.name)).to.be(false);

        [player1, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.MINER_MOLE,
            maxToSelect: 1,
            minToSelect: 1,
            cardOptions: [
              ...player1.getPlayedCardInfos(CardName.FARM),
              ...player1.getPlayedCardInfos(CardName.GENERAL_STORE),
              ...player2.getPlayedCardInfos(CardName.GENERAL_STORE),
            ],
            clientOptions: {
              selectedCards: player1.getPlayedCardInfos(CardName.GENERAL_STORE),
            },
          },
        ]);

        // 2 berries because player 1 has a farm
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
      });
    });

    describe(CardName.MONASTERY, () => {
      it("work", () => {
        player.addToCity(CardName.MONASTERY);
        expect(() => {
          multiStepGameInputTest(gameState, [
            {
              inputType: GameInputType.VISIT_DESTINATION_CARD,
              clientOptions: {
                playedCard: player.getFirstPlayedCard(CardName.MONASTERY),
              },
            },
          ]);
        }).to.throwException(/need at least 2 resources/i);

        player.gainResources({
          [ResourceType.BERRY]: 2,
        });
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        const targetPlayerId = gameState.players[1].playerId;

        const selectResourcesInput = {
          inputType: GameInputType.SELECT_RESOURCES as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD,
          cardContext: CardName.MONASTERY,
          toSpend: true,
          clientOptions: {
            resources: {
              [ResourceType.BERRY]: 2,
            },
          },
          maxResources: 2,
          minResources: 2,
        };

        const selectPlayerInput = {
          inputType: GameInputType.SELECT_PLAYER as const,
          prevInputType: GameInputType.SELECT_RESOURCES,
          prevInput: selectResourcesInput,
          cardContext: CardName.MONASTERY,
          playerOptions: [targetPlayerId],
          mustSelectOne: true,
          clientOptions: {
            selectedPlayer: targetPlayerId,
          },
        };
        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.MONASTERY),
            },
          },
          selectResourcesInput,
          selectPlayerInput,
        ]);

        const targetPlayer = gameState.getPlayer(targetPlayerId);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(4);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(targetPlayer.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
      });
    });

    describe(CardName.MONK, () => {
      it("should do nothing if no resources", () => {
        const card = Card.fromName(CardName.MONK);
        player.cardsInHand = [CardName.MONK];
        player.gainResources(card.baseCost);
        multiStepGameInputTest(gameState, [playCardInput(card.name)], {
          autoAdvance: true,
        });
      });

      it("should allow player to give up 2 berries for vp", () => {
        const card = Card.fromName(CardName.MONK);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        player.cardsInHand = [CardName.MONK];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.BERRY]: 2,
        });

        const selectResourceGameInput = {
          inputType: GameInputType.SELECT_RESOURCES as const,
          prevInputType: GameInputType.PLAY_CARD as const,
          toSpend: true,
          cardContext: CardName.MONK,
          maxResources: 2,
          minResources: 0,
          specificResource: ResourceType.BERRY,
          clientOptions: {
            resources: {
              [ResourceType.BERRY]: 2,
            },
          },
        };

        const targetPlayerId = gameState.players[1].playerId;
        expect(
          gameState
            .getPlayer(targetPlayerId)
            .getNumResourcesByType(ResourceType.BERRY)
        ).to.be(0);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          selectResourceGameInput,
          {
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.SELECT_RESOURCES,
            prevInput: selectResourceGameInput,
            cardContext: CardName.MONK,
            mustSelectOne: true,
            playerOptions: [targetPlayerId],
            clientOptions: {
              selectedPlayer: targetPlayerId,
            },
          },
        ]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(4);
        expect(
          gameState
            .getPlayer(targetPlayerId)
            .getNumResourcesByType(ResourceType.BERRY)
        ).to.be(2);
      });

      it("should not allow player to give up non-existent berries", () => {
        const card = Card.fromName(CardName.MONK);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        player.cardsInHand = [CardName.MONK];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.BERRY]: 1,
        });

        const selectResourceGameInput = {
          inputType: GameInputType.SELECT_RESOURCES as const,
          toSpend: true,
          prevInputType: GameInputType.PLAY_CARD as const,
          cardContext: CardName.MONK,
          maxResources: 2,
          minResources: 0,
          specificResource: ResourceType.BERRY,
          clientOptions: {
            resources: {
              [ResourceType.BERRY]: 2,
            },
          },
        };

        const targetPlayerId = gameState.players[1].playerId;

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(card.name),
            selectResourceGameInput,
            {
              inputType: GameInputType.SELECT_PLAYER,
              prevInputType: GameInputType.SELECT_RESOURCES,
              prevInput: selectResourceGameInput,
              cardContext: CardName.MONK,
              mustSelectOne: true,
              playerOptions: [targetPlayerId],
              clientOptions: {
                selectedPlayer: targetPlayerId,
              },
            },
          ]);
        }).to.throwException(/insufficient/i);
      });

      it("should not allow player to give more than 2 resources", () => {
        const card = Card.fromName(CardName.MONK);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        player.cardsInHand = [CardName.MONK];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.BERRY]: 4,
        });

        const selectResourceGameInput = {
          inputType: GameInputType.SELECT_RESOURCES as const,
          toSpend: true,
          prevInputType: GameInputType.PLAY_CARD as const,
          cardContext: CardName.MONK,
          maxResources: 2,
          minResources: 0,
          specificResource: ResourceType.BERRY,
          clientOptions: {
            resources: {
              [ResourceType.BERRY]: 4,
            },
          },
        };

        const targetPlayerId = gameState.players[1].playerId;

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(card.name),
            selectResourceGameInput,
            {
              inputType: GameInputType.SELECT_PLAYER,
              prevInputType: GameInputType.SELECT_RESOURCES,
              prevInput: selectResourceGameInput,
              cardContext: CardName.MONK,
              mustSelectOne: true,
              playerOptions: [targetPlayerId],
              clientOptions: {
                selectedPlayer: targetPlayerId,
              },
            },
          ]);
        }).to.throwException(/too many/i);
      });

      it("should not allow player to give themselves berries", () => {
        const card = Card.fromName(CardName.MONK);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        player.cardsInHand = [CardName.MONK];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.BERRY]: 4,
        });

        const selectResourceGameInput = {
          inputType: GameInputType.SELECT_RESOURCES as const,
          toSpend: true,
          prevInputType: GameInputType.PLAY_CARD as const,
          cardContext: CardName.MONK,
          maxResources: 2,
          minResources: 0,
          specificResource: ResourceType.BERRY,
          clientOptions: {
            resources: {
              [ResourceType.BERRY]: 2,
            },
          },
        };

        const targetPlayerId = gameState.players[1].playerId;

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(card.name),
            selectResourceGameInput,
            {
              inputType: GameInputType.SELECT_PLAYER,
              prevInputType: GameInputType.SELECT_RESOURCES,
              prevInput: selectResourceGameInput,
              cardContext: CardName.MONK,
              mustSelectOne: true,
              playerOptions: [targetPlayerId],
              clientOptions: {
                selectedPlayer: player.playerId,
              },
            },
          ]);
        }).to.throwException(/invalid/i);
      });
    });

    describe(CardName.PALACE, () => {
      it("worth 1 vp more per unique construction", () => {
        const card = Card.fromName(CardName.PALACE);
        player.addToCity(card.name);
        const playerId = player.playerId;

        expect(card.getPoints(gameState, playerId)).to.be(4 + 1);

        player.addToCity(CardName.DUNGEON);
        expect(card.getPoints(gameState, playerId)).to.be(4 + 2);

        player.addToCity(CardName.THEATRE);
        expect(card.getPoints(gameState, playerId)).to.be(4 + 3);

        player.addToCity(CardName.UNIVERSITY);
        expect(card.getPoints(gameState, playerId)).to.be(4 + 4);

        player.addToCity(CardName.FARM);
        expect(card.getPoints(gameState, playerId)).to.be(4 + 4);

        player.addToCity(CardName.RANGER);
        expect(card.getPoints(gameState, playerId)).to.be(4 + 4);
      });
    });

    describe(CardName.PEDDLER, () => {
      it("should do nothing if no resources", () => {
        const card = Card.fromName(CardName.PEDDLER);

        player.cardsInHand = [CardName.PEDDLER];
        player.gainResources(card.baseCost);
        [player, gameState] = multiStepGameInputTest(
          gameState,
          [playCardInput(card.name)],
          { autoAdvance: true }
        );
      });

      it("should allow player to swap 2 resources", () => {
        const card = Card.fromName(CardName.PEDDLER);

        player.cardsInHand = [CardName.PEDDLER];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.PEBBLE]: 1,
          [ResourceType.RESIN]: 1,
        });

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_RESOURCES,
            toSpend: true,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.PEDDLER,
            maxResources: 2,
            minResources: 0,
            clientOptions: {
              resources: {
                [ResourceType.PEBBLE]: 1,
                [ResourceType.RESIN]: 1,
              },
            },
          },
          {
            inputType: GameInputType.SELECT_RESOURCES,
            toSpend: false,
            prevInputType: GameInputType.SELECT_RESOURCES,
            cardContext: CardName.PEDDLER,
            maxResources: 2,
            minResources: 2,
            clientOptions: {
              resources: {
                [ResourceType.BERRY]: 2,
              },
            },
          },
        ]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);
      });

      it("should not allow player to swap 2 non-existent resources", () => {
        const card = Card.fromName(CardName.PEDDLER);
        player.cardsInHand = [CardName.PEDDLER];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.PEBBLE]: 1,
          [ResourceType.RESIN]: 1,
        });

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(card.name),
            {
              inputType: GameInputType.SELECT_RESOURCES,
              toSpend: true,
              prevInputType: GameInputType.PLAY_CARD,
              cardContext: CardName.PEDDLER,
              maxResources: 2,
              minResources: 0,
              clientOptions: {
                resources: {
                  [ResourceType.PEBBLE]: 2,
                },
              },
            },
          ]);
        }).to.throwException(/insufficient/i);
      });

      it("should not allow player to swap more than 2 resources", () => {
        const card = Card.fromName(CardName.PEDDLER);
        player.cardsInHand = [CardName.PEDDLER];
        player.gainResources(card.baseCost);
        player.gainResources({
          [ResourceType.PEBBLE]: 2,
          [ResourceType.RESIN]: 2,
        });

        expect(() => {
          multiStepGameInputTest(gameState, [
            playCardInput(card.name),
            {
              inputType: GameInputType.SELECT_RESOURCES,
              toSpend: true,
              prevInputType: GameInputType.PLAY_CARD,
              cardContext: CardName.PEDDLER,
              maxResources: 2,
              minResources: 0,
              clientOptions: {
                resources: {
                  [ResourceType.PEBBLE]: 2,
                  [ResourceType.RESIN]: 2,
                },
              },
            },
          ]);
        }).to.throwException(/too many/i);
      });
    });

    describe(CardName.POSTAL_PIGEON, () => {
      it("should allow the player to select a card to play", () => {
        const card = Card.fromName(CardName.POSTAL_PIGEON);
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        gameState.deck.addToStack(CardName.FARM);
        gameState.deck.addToStack(CardName.MINE);

        expect(gameState.discardPile.length).to.eql(0);
        expect(gameState.pendingGameInputs).to.eql([]);
        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.MINE)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.POSTAL_PIGEON,
            maxToSelect: 1,
            minToSelect: 0,
            cardOptions: [CardName.MINE, CardName.FARM],
            cardOptionsUnfiltered: [CardName.MINE, CardName.FARM],
            clientOptions: {
              selectedCards: [CardName.MINE],
            },
          },
        ]);

        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.MINE)).to.be(true);
        expect(gameState.discardPile.length).to.eql(1);
        expect(gameState.pendingGameInputs).to.eql([]);
      });

      it("should only allow the player to select eligible cards", () => {
        const card = Card.fromName(CardName.POSTAL_PIGEON);
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        // Add cards that have too high vp
        gameState.deck.addToStack(CardName.KING);
        gameState.deck.addToStack(CardName.QUEEN);

        expect(gameState.discardPile.length).to.eql(0);
        expect(gameState.pendingGameInputs).to.eql([]);
        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.MINE)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.POSTAL_PIGEON,
            maxToSelect: 1,
            minToSelect: 0,
            cardOptions: [],
            cardOptionsUnfiltered: [CardName.QUEEN, CardName.KING],
            clientOptions: {
              selectedCards: [],
            },
          },
        ]);

        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(gameState.discardPile.length).to.eql(2);
      });

      it("should trigger production cards when played via the postal pigeon", () => {
        const card = Card.fromName(CardName.POSTAL_PIGEON);
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        gameState.deck.addToStack(CardName.FARM);
        gameState.deck.addToStack(CardName.MINE);

        expect(gameState.discardPile.length).to.eql(0);
        expect(gameState.pendingGameInputs).to.eql([]);
        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.MINE)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.POSTAL_PIGEON,
            maxToSelect: 1,
            minToSelect: 0,
            cardOptions: [CardName.MINE, CardName.FARM],
            cardOptionsUnfiltered: [CardName.MINE, CardName.FARM],
            clientOptions: {
              selectedCards: [CardName.MINE],
            },
          },
        ]);

        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.MINE)).to.be(true);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
      });

      it("should trigger HISTORIAN/SHOPKEEPER cards when played via the postal pigeon", () => {
        const card = Card.fromName(CardName.POSTAL_PIGEON);
        player.gainResources(card.baseCost);
        player.addToCity(CardName.HISTORIAN);
        player.addToCity(CardName.SHOPKEEPER);

        gameState.deck.addToStack(CardName.WANDERER);
        gameState.deck.addToStack(CardName.FARM);

        // For historian
        gameState.deck.addToStack(CardName.WIFE);

        player.cardsInHand = [card.name];

        expect(gameState.discardPile.length).to.eql(0);
        expect(player.cardsInHand.length).to.eql(1);
        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.WANDERER)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.POSTAL_PIGEON,
            maxToSelect: 1,
            minToSelect: 0,
            cardOptions: [CardName.FARM, CardName.WANDERER],
            cardOptionsUnfiltered: [CardName.FARM, CardName.WANDERER],
            clientOptions: {
              selectedCards: [CardName.WANDERER],
            },
          },
        ]);

        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.WANDERER)).to.be(true);
        // From shopkeeper (1 for postal pigeon, 1 for wanderer)
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        // From historian (2 cards) and wanderer
        expect(player.cardsInHand.length).to.eql(3 + 2);
      });

      it("should trigger COURTHOUSE cards when played via the postal pigeon", () => {
        const card = Card.fromName(CardName.POSTAL_PIGEON);
        player.gainResources(card.baseCost);
        player.addToCity(CardName.HISTORIAN);
        player.addToCity(CardName.COURTHOUSE);

        gameState.deck.addToStack(CardName.WANDERER);
        gameState.deck.addToStack(CardName.FARM);

        // For historian
        gameState.deck.addToStack(CardName.WIFE);

        player.cardsInHand = [card.name];

        expect(gameState.discardPile.length).to.eql(0);
        expect(player.cardsInHand.length).to.eql(1);
        expect(player.hasCardInCity(card.name)).to.be(false);
        expect(player.hasCardInCity(CardName.MINE)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.POSTAL_PIGEON,
            maxToSelect: 1,
            minToSelect: 0,
            cardOptions: [CardName.FARM, CardName.WANDERER],
            cardOptionsUnfiltered: [CardName.FARM, CardName.WANDERER],
            clientOptions: {
              selectedCards: [CardName.FARM],
            },
          },
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.COURTHOUSE,
            options: ["TWIG", "RESIN", "PEBBLE"],
            clientOptions: {
              selectedOption: "TWIG",
            },
          },
        ]);

        expect(player.hasCardInCity(card.name)).to.be(true);
        expect(player.hasCardInCity(CardName.FARM)).to.be(true);

        // From farm production
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
        // From historian (postal pigeon + farm)
        expect(player.cardsInHand.length).to.eql(2);
        // From COURTHOUSE
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(1);
      });
    });

    describe(CardName.POST_OFFICE, () => {
      it("should not be visitable if player has less than 2 cards", () => {
        const card = Card.fromName(CardName.POST_OFFICE);
        player.cardsInHand = [];
        player.addToCity(CardName.POST_OFFICE);

        const visitDestinationInput = {
          inputType: GameInputType.VISIT_DESTINATION_CARD as const,
          clientOptions: {
            playedCard: player.getFirstPlayedCard(CardName.POST_OFFICE),
          },
        };

        expect(card.canPlay(gameState, visitDestinationInput)).to.be(false);
        player.cardsInHand = [CardName.FARM, CardName.MONK];
        expect(card.canPlay(gameState, visitDestinationInput)).to.be(true);
      });

      it("should give another player 2 cards and draw max cards", () => {
        let targetPlayer = gameState.players[1];

        player.cardsInHand = [
          CardName.FARM,
          CardName.MINE,
          CardName.QUEEN,
          CardName.KING,
        ];
        player.addToCity(CardName.POST_OFFICE);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getPlayedCardInfos(CardName.POST_OFFICE)).to.eql([
          {
            cardOwnerId: player.playerId,
            cardName: CardName.POST_OFFICE,
            usedForCritter: false,
            workers: [],
          },
        ]);

        for (let i = 0; i < 8; i++) {
          gameState.deck.addToStack(CardName.MINER_MOLE);
        }

        const visitDestinationInput = {
          inputType: GameInputType.VISIT_DESTINATION_CARD as const,
          clientOptions: {
            playedCard: player.getFirstPlayedCard(CardName.POST_OFFICE),
          },
        };

        const selectPlayer = {
          inputType: GameInputType.SELECT_PLAYER as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD as const,
          cardContext: CardName.POST_OFFICE,
          playerOptions: [targetPlayer.playerId],
          mustSelectOne: true,
          clientOptions: {
            selectedPlayer: targetPlayer.playerId,
          },
        };

        const selectCardsToGiveAway = {
          inputType: GameInputType.SELECT_CARDS as const,
          prevInputType: GameInputType.SELECT_PLAYER as const,
          prevInput: selectPlayer,
          cardContext: CardName.POST_OFFICE,
          cardOptions: player.cardsInHand,
          maxToSelect: 2,
          minToSelect: 2,
          clientOptions: {
            selectedCards: [CardName.MINE, CardName.QUEEN],
          },
        };

        const selectCardsToDiscard = {
          inputType: GameInputType.SELECT_CARDS as const,
          prevInputType: GameInputType.SELECT_CARDS as const,
          cardContext: CardName.POST_OFFICE,
          cardOptions: [CardName.FARM, CardName.KING],
          maxToSelect: 2,
          minToSelect: 0,
          clientOptions: {
            selectedCards: [CardName.FARM, CardName.KING],
          },
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          visitDestinationInput,
          selectPlayer,
          selectCardsToGiveAway,
          selectCardsToDiscard,
        ]);

        targetPlayer = gameState.getPlayer(targetPlayer.playerId);
        expect(player.numAvailableWorkers).to.be(1);
        expect(player.getPlayedCardInfos(CardName.POST_OFFICE)).to.eql([
          {
            cardOwnerId: player.playerId,
            cardName: CardName.POST_OFFICE,
            usedForCritter: false,
            workers: [player.playerId],
          },
        ]);
        expect(targetPlayer.cardsInHand).to.eql([
          CardName.MINE,
          CardName.QUEEN,
        ]);
        expect(player.cardsInHand).to.eql([
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
          CardName.MINER_MOLE,
        ]);
      });
    });

    describe(CardName.QUEEN, () => {
      it("should allow player to choose to play card from meadow OR hand", () => {
        gameState = testInitialGameState({
          meadowCards: [CardName.FARM],
        });
        player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.QUEEN);
        player.cardsInHand.push(CardName.FARM);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.FARM)).to.be(false);

        const selectCardInput = {
          inputType: GameInputType.SELECT_CARDS as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD,
          cardContext: CardName.QUEEN,
          cardOptions: [CardName.FARM, CardName.FARM],
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: [CardName.FARM],
          },
        };

        const selectCardFromMeadowSourceInput = {
          inputType: GameInputType.SELECT_OPTION_GENERIC as const,
          prevInputType: GameInputType.SELECT_CARDS,
          prevInput: selectCardInput,
          cardContext: CardName.QUEEN,
          options: ["Meadow", "Hand"],
          clientOptions: { selectedOption: "Meadow" },
        };

        const selectCardFromHandSourceInput = {
          inputType: GameInputType.SELECT_OPTION_GENERIC as const,
          prevInputType: GameInputType.SELECT_CARDS,
          prevInput: selectCardInput,
          cardContext: CardName.QUEEN,
          options: ["Meadow", "Hand"],
          clientOptions: { selectedOption: "Hand" },
        };

        const [playerMeadow, gameState2] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          selectCardInput,
          selectCardFromMeadowSourceInput,
        ]);

        expect(gameState2.meadowCards.indexOf(CardName.FARM)).to.be(-1);
        expect(playerMeadow.cardsInHand.indexOf(CardName.FARM)).to.be(0);
        expect(playerMeadow.numAvailableWorkers).to.be(1);
        expect(playerMeadow.hasCardInCity(CardName.FARM)).to.be(true);

        const [playerHand, gameState3] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          selectCardInput,
          selectCardFromHandSourceInput,
        ]);

        expect(gameState3.meadowCards.indexOf(CardName.FARM)).to.be(0);
        expect(playerHand.cardsInHand.indexOf(CardName.FARM)).to.be(-1);
        expect(playerHand.numAvailableWorkers).to.be(1);
        expect(playerHand.hasCardInCity(CardName.FARM)).to.be(true);
      });

      it("should allow player to buy card from hand for less than 3 points for free", () => {
        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.QUEEN);
        player.cardsInHand.push(CardName.HUSBAND);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.HUSBAND)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.QUEEN,
            cardOptions: [CardName.HUSBAND],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.HUSBAND],
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.HUSBAND)).to.be(true);
        expect(player.cardsInHand.indexOf(CardName.HUSBAND)).to.be(-1);
      });

      it("should allow player to play card from the meadow for less than 3 points for free", () => {
        gameState = testInitialGameState({
          meadowCards: [
            CardName.KING,
            CardName.QUEEN,
            CardName.POSTAL_PIGEON,
            CardName.POSTAL_PIGEON,
            CardName.FARM,
            CardName.HUSBAND,
            CardName.CHAPEL,
            CardName.MONK,
          ],
        });
        player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.QUEEN);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.HUSBAND)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.QUEEN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.CHAPEL,
              CardName.MONK,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.HUSBAND],
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.HUSBAND)).to.be(true);
        expect(gameState.meadowCards.indexOf(CardName.HUSBAND)).to.be(-1);
      });

      it("should allow player to play card worth exactly 3 points for free", () => {
        gameState = testInitialGameState({
          meadowCards: [
            CardName.KING,
            CardName.QUEEN,
            CardName.POSTAL_PIGEON,
            CardName.POSTAL_PIGEON,
            CardName.FARM,
            CardName.HUSBAND,
            CardName.CHAPEL,
            CardName.FAIRGROUNDS,
          ],
        });
        let player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.QUEEN);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.hasCardInCity(CardName.FAIRGROUNDS)).to.be(false);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.QUEEN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.CHAPEL,
              CardName.FAIRGROUNDS,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.FAIRGROUNDS],
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(gameState.meadowCards.indexOf(CardName.FAIRGROUNDS)).to.be(-1);
        expect(player.hasCardInCity(CardName.FAIRGROUNDS)).to.be(true);
      });

      it("should not allow player to buy card for than 3 points", () => {
        gameState = testInitialGameState({
          meadowCards: [
            CardName.KING,
            CardName.QUEEN,
            CardName.POSTAL_PIGEON,
            CardName.POSTAL_PIGEON,
            CardName.FARM,
            CardName.HUSBAND,
            CardName.CHAPEL,
            CardName.MONK,
          ],
        });
        const player = gameState.getActivePlayer();

        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.QUEEN);

        expect(player.numAvailableWorkers).to.be(2);

        gameState = gameState.next({
          inputType: GameInputType.VISIT_DESTINATION_CARD,
          clientOptions: {
            playedCard: player.getFirstPlayedCard(CardName.QUEEN),
          },
        });

        expect(() => {
          gameState.next({
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.QUEEN,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.CHAPEL,
              CardName.MONK,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.KING],
            },
          });
        }).to.throwException(/cannot use Queen/i);
      });

      it("should not allow player to visit the queen if there are no applicable cards", () => {
        gameState = testInitialGameState({
          meadowCards: [
            CardName.KING,
            CardName.KING,
            CardName.KING,
            CardName.KING,
            CardName.KING,
            CardName.KING,
            CardName.KING,
            CardName.KING,
          ],
        });
        const player = gameState.getActivePlayer();
        const card = Card.fromName(CardName.QUEEN);
        player.addToCity(CardName.QUEEN);

        expect(() => {
          gameState.next({
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          });
        }).to.throwException(/no playable cards/i);
      });

      it("should not allow player to visit the queen if there are no playable cards", () => {
        gameState = testInitialGameState({
          meadowCards: [
            CardName.WIFE,
            CardName.WIFE,
            CardName.WIFE,
            CardName.WIFE,
            CardName.WIFE,
            CardName.WIFE,
            CardName.WIFE,
            CardName.WIFE,
          ],
        });
        const player = gameState.getActivePlayer();
        const card = Card.fromName(CardName.QUEEN);
        player.cardsInHand.push(CardName.WIFE);

        // Fill up city
        player.addToCity(CardName.QUEEN);
        for (let i = 0; i < 14; i++) {
          player.addToCity(CardName.FARM);
        }

        expect(() => {
          gameState.next({
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          });
        }).to.throwException(/no playable cards/i);
      });

      it("should allow player to visit the queen and play RUINS if the city is full", () => {
        const card = Card.fromName(CardName.QUEEN);
        const cards = [
          CardName.WIFE,
          CardName.WIFE,
          CardName.WIFE,
          CardName.WIFE,
          CardName.WIFE,
          CardName.WIFE,
          CardName.WIFE,
          CardName.WIFE,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        let player = gameState.getActivePlayer();

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(CardName.RUINS);
        player.addToCity(CardName.QUEEN);
        for (let i = 0; i < 14; i++) {
          player.addToCity(CardName.FARM);
        }

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardOptions: [CardName.RUINS],
            maxToSelect: 1,
            minToSelect: 1,
            cardContext: CardName.QUEEN,
            clientOptions: { selectedCards: [CardName.RUINS] },
          },
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardOptions: player.getPlayedCardInfos(CardName.FARM),
            cardContext: CardName.RUINS,
            playedCardContext: undefined,
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [player.getFirstPlayedCard(CardName.FARM)],
            },
          },
        ]);

        expect(player.hasCardInCity(CardName.RUINS)).to.be(true);
      });
    });

    describe(CardName.RANGER, () => {
      it("should do nothing if there's no placed workers", () => {
        const card = Card.fromName(CardName.RANGER);
        player.cardsInHand = [CardName.RANGER];
        player.gainResources(card.baseCost);
        multiStepGameInputTest(gameState, [playCardInput(card.name)]);
      });

      it("should do nothing if there's no recallable workers", () => {
        const card = Card.fromName(CardName.RANGER);
        player.cardsInHand = [CardName.RANGER];
        player.gainResources(card.baseCost);

        player.placeWorkerOnLocation(LocationName.JOURNEY_FIVE);

        multiStepGameInputTest(gameState, [playCardInput(card.name)]);
      });

      it("should prompt to move an existing worker and trigger the new placement", () => {
        const card = Card.fromName(CardName.RANGER);
        player.cardsInHand = [CardName.RANGER];
        player.gainResources(card.baseCost);

        gameState.locationsMap[LocationName.BASIC_ONE_STONE]!.push(
          player.playerId
        );
        player.placeWorkerOnLocation(LocationName.BASIC_ONE_STONE);
        expect(player.numAvailableWorkers).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.cardsInHand.length).to.be(1);

        const recallWorkerInput = {
          inputType: GameInputType.SELECT_WORKER_PLACEMENT as const,
          prevInputType: GameInputType.PLAY_CARD,
          cardContext: CardName.RANGER,
          mustSelectOne: true,
          clientOptions: {
            selectedOption: {
              location: LocationName.BASIC_ONE_STONE,
            },
          },
          options: [{ location: LocationName.BASIC_ONE_STONE }],
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          recallWorkerInput,
          {
            inputType: GameInputType.SELECT_WORKER_PLACEMENT,
            prevInput: recallWorkerInput,
            prevInputType: GameInputType.SELECT_WORKER_PLACEMENT,
            cardContext: CardName.RANGER,
            mustSelectOne: true,
            options: [
              { location: LocationName.BASIC_ONE_BERRY },
              { location: LocationName.BASIC_ONE_BERRY_AND_ONE_CARD },
              { location: LocationName.BASIC_ONE_RESIN_AND_ONE_CARD },
              { location: LocationName.BASIC_THREE_TWIGS },
              { location: LocationName.BASIC_TWO_CARDS_AND_ONE_VP },
              { location: LocationName.BASIC_TWO_RESIN },
              { location: LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD },
              { location: LocationName.HAVEN },
            ],
            clientOptions: {
              selectedOption: {
                location: LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD,
              },
            },
          },
        ]);
        expect(
          gameState.locationsMap[LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD]
        ).to.eql([player.playerId]);
        expect(player.numAvailableWorkers).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
        expect(player.cardsInHand.length).to.be(1);
      });

      it("should not allow moving the worker back to the same location", () => {
        const card = Card.fromName(CardName.RANGER);
        player.cardsInHand = [CardName.RANGER];
        player.gainResources(card.baseCost);

        gameState.locationsMap[LocationName.BASIC_ONE_STONE]!.push(
          player.playerId
        );
        gameState.locationsMap[LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD]!.push(
          player.playerId
        );
        player.placeWorkerOnLocation(LocationName.BASIC_ONE_STONE);
        player.placeWorkerOnLocation(LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD);
        expect(player.numAvailableWorkers).to.be(0);

        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.cardsInHand.length).to.be(1);

        const recallWorkerInput = {
          inputType: GameInputType.SELECT_WORKER_PLACEMENT as const,
          prevInputType: GameInputType.PLAY_CARD,
          cardContext: CardName.RANGER,
          mustSelectOne: true,
          clientOptions: {
            selectedOption: {
              location: LocationName.BASIC_ONE_STONE,
            },
          },
          options: [
            { location: LocationName.BASIC_ONE_STONE },
            { location: LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD },
          ],
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          recallWorkerInput,
          {
            inputType: GameInputType.SELECT_WORKER_PLACEMENT,
            prevInput: recallWorkerInput,
            prevInputType: GameInputType.SELECT_WORKER_PLACEMENT,
            cardContext: CardName.RANGER,
            mustSelectOne: true,
            options: [
              { location: LocationName.BASIC_ONE_BERRY },
              { location: LocationName.BASIC_ONE_BERRY_AND_ONE_CARD },
              { location: LocationName.BASIC_ONE_RESIN_AND_ONE_CARD },
              { location: LocationName.BASIC_THREE_TWIGS },
              { location: LocationName.BASIC_TWO_CARDS_AND_ONE_VP },
              { location: LocationName.BASIC_TWO_RESIN },
              { location: LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD },
              { location: LocationName.HAVEN },
            ],
            clientOptions: {
              selectedOption: {
                location: LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD,
              },
            },
          },
        ]);
        expect(
          gameState.locationsMap[LocationName.BASIC_TWO_TWIGS_AND_ONE_CARD]
        ).to.eql([player.playerId, player.playerId]);
        expect(player.numAvailableWorkers).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
        expect(player.cardsInHand.length).to.be(1);
      });
    });

    describe(CardName.RESIN_REFINERY, () => {
      it("should gain 1 RESIN when played", () => {
        const card = Card.fromName(CardName.RESIN_REFINERY);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);

        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(1);
        expect(player.hasCardInCity(card.name)).to.be(true);
      });
    });

    describe(CardName.RUINS, () => {
      it("should not be playable if there's no construction in the city", () => {
        const card = Card.fromName(CardName.RUINS);
        player.cardsInHand.push(card.name);
        expect(() => {
          [player, gameState] = multiStepGameInputTest(gameState, [
            playCardInput(card.name),
          ]);
        }).to.throwException(/Require an existing construction to play Ruins/i);
      });

      it("should be playable if there's a construction in the city", () => {
        const card = Card.fromName(CardName.RUINS);
        player.cardsInHand.push(card.name);
        player.addToCity(CardName.FARM);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardOptions: player.getPlayedCardInfos(CardName.FARM),
            cardContext: CardName.RUINS,
            playedCardContext: undefined,
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [player.getFirstPlayedCard(CardName.FARM)],
            },
          },
        ]);
        expect(player.hasCardInCity(CardName.FARM)).to.be(false);
        expect(player.hasCardInCity(CardName.RUINS)).to.be(true);
      });

      it("should be playable even if there's no space in the city", () => {
        const card = Card.fromName(CardName.RUINS);
        player.cardsInHand.push(card.name);
        player.addToCity(CardName.FARM);
        for (let i = 0; i < 14; i++) {
          player.addToCity(CardName.HUSBAND);
        }
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardOptions: player.getPlayedCardInfos(CardName.FARM),
            cardContext: CardName.RUINS,
            playedCardContext: undefined,
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [player.getFirstPlayedCard(CardName.FARM)],
            },
          },
        ]);
        expect(player.hasCardInCity(CardName.FARM)).to.be(false);
        expect(player.hasCardInCity(CardName.RUINS)).to.be(true);
      });
    });

    describe(CardName.SCHOOL, () => {
      it("worth 1 extra VP per common critter", () => {
        const card = Card.fromName(CardName.SCHOOL);
        player.addToCity(card.name);
        const playerId = player.playerId;

        expect(card.getPoints(gameState, playerId)).to.be(2 + 0);

        player.addToCity(CardName.DUNGEON);
        expect(card.getPoints(gameState, playerId)).to.be(2 + 0);

        player.addToCity(CardName.RANGER);
        expect(card.getPoints(gameState, playerId)).to.be(2 + 0);

        player.addToCity(CardName.HUSBAND);
        expect(card.getPoints(gameState, playerId)).to.be(2 + 1);

        player.addToCity(CardName.WANDERER);
        expect(card.getPoints(gameState, playerId)).to.be(2 + 2);

        player.addToCity(CardName.WANDERER);
        expect(card.getPoints(gameState, playerId)).to.be(2 + 3);
      });
    });

    describe(CardName.SHEPHERD, () => {
      it("play shepherd using berries", () => {
        let player1 = gameState.players[0];
        let player2 = gameState.players[1];
        const card = Card.fromName(CardName.SHEPHERD);

        // Make sure we can play this card
        player1.gainResources(card.baseCost);
        player1.addCardToHand(gameState, card.name);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
        expect(player2.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.PLAY_CARD,
            prevInput: playCardInput(card.name),
            cardContext: CardName.SHEPHERD,
            playerOptions: [player2.playerId],
            mustSelectOne: true,
            clientOptions: {
              selectedPlayer: player2.playerId,
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);
        player2 = gameState.getPlayer(player2.playerId);

        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player2.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      });

      it("play shepherd using mixed resources (eg judge)", () => {
        let player1 = gameState.players[0];
        let player2 = gameState.players[1];
        const card = Card.fromName(CardName.SHEPHERD);

        // Make sure we can play this card

        player1.gainResources({
          [ResourceType.TWIG]: 3,
          [ResourceType.BERRY]: 2,
        });
        player1.addCardToHand(gameState, card.name);
        player1.addToCity(CardName.JUDGE);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        expect(player2.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.PLAY_CARD,
            clientOptions: {
              card: card.name,
              fromMeadow: false,
              paymentOptions: {
                resources: {
                  [ResourceType.TWIG]: 1,
                  [ResourceType.BERRY]: 2,
                },
              },
            },
          },
          {
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.PLAY_CARD,
            prevInput: {
              inputType: GameInputType.PLAY_CARD,
              clientOptions: {
                card: card.name,
                fromMeadow: false,
                paymentOptions: {
                  resources: {
                    [ResourceType.TWIG]: 1,
                    [ResourceType.BERRY]: 2,
                  },
                },
              },
            },
            cardContext: CardName.SHEPHERD,
            playerOptions: [player2.playerId],
            mustSelectOne: true,
            clientOptions: {
              selectedPlayer: player2.playerId,
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);
        player2 = gameState.getPlayer(player2.playerId);

        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player1.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
        expect(player2.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        expect(player2.getNumResourcesByType(ResourceType.TWIG)).to.be(1);
      });

      it("playing shepherd via queen should not cost resources", () => {
        let player1 = gameState.players[0];
        let player2 = gameState.players[1];
        const card = Card.fromName(CardName.SHEPHERD);

        // Make sure we can play this card

        player1.gainResources({
          [ResourceType.TWIG]: 3,
          [ResourceType.BERRY]: 2,
        });
        player1.addCardToHand(gameState, card.name);
        player1.addToCity(CardName.QUEEN);
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
        expect(player2.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player1.getFirstPlayedCard(CardName.QUEEN),
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.VISIT_DESTINATION_CARD,
            cardContext: CardName.QUEEN,
            cardOptions: [CardName.SHEPHERD],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.SHEPHERD],
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);
        player2 = gameState.getPlayer(player2.playerId);

        expect(player1.hasCardInCity(CardName.SHEPHERD));
        expect(player1.getNumResourcesByType(ResourceType.BERRY)).to.be(5);
        expect(player1.getNumResourcesByType(ResourceType.TWIG)).to.be(3);
        expect(player2.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player2.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      });
    });

    describe(CardName.SHOPKEEPER, () => {
      it("should do nothing if player plays a construction", () => {
        player.addToCity(CardName.SHOPKEEPER);

        const cardToPlay = Card.fromName(CardName.MINE);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
        ]);

        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      });

      it("should gain a berry if player plays a critter", () => {
        player.addToCity(CardName.SHOPKEEPER);

        const cardToPlay = Card.fromName(CardName.QUEEN);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      });

      it("should not gain a berry when playing a shopkeeper", () => {
        const cardToPlay = Card.fromName(CardName.SHOPKEEPER);
        player.cardsInHand = [cardToPlay.name];
        player.gainResources(cardToPlay.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(cardToPlay.name),
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      });
    });

    describe(CardName.STOREHOUSE, () => {
      it("should allow player to choose resources to place on card", () => {
        const card = Card.fromName(CardName.STOREHOUSE);
        player.cardsInHand = [card.name];

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: card.name,
            playedCardContext: {
              cardName: card.name,
              cardOwnerId: player.playerId,
              workers: [],
              resources: {
                BERRY: 0,
                PEBBLE: 0,
                RESIN: 0,
                TWIG: 0,
              },
              usedForCritter: false,
            },
            options: ["3 TWIG", "2 RESIN", "1 PEBBLE", "2 BERRY"],
            clientOptions: {
              selectedOption: "3 TWIG",
            },
          },
        ]);

        const playedCard = player.getFirstPlayedCard(card.name);
        expect(playedCard).to.eql({
          cardName: card.name,
          cardOwnerId: player.playerId,
          resources: {
            BERRY: 0,
            PEBBLE: 0,
            RESIN: 0,
            TWIG: 3,
          },
          workers: [],
          usedForCritter: false,
        });
      });

      it("should add resources to the correct storehouse", () => {
        const card = Card.fromName(CardName.STOREHOUSE);
        player.cardsInHand = [card.name];

        // play one store card
        const storehouse1 = player.addToCity(card.name);
        // put 5 berries on it.
        storehouse1.resources![ResourceType.BERRY]! = 5;

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: card.name,
            playedCardContext: {
              cardName: card.name,
              cardOwnerId: player.playerId,
              resources: {
                BERRY: 0,
                PEBBLE: 0,
                RESIN: 0,
                TWIG: 0,
              },
              usedForCritter: false,
              workers: [],
            },
            options: ["3 TWIG", "2 RESIN", "1 PEBBLE", "2 BERRY"],
            clientOptions: {
              selectedOption: "3 TWIG",
            },
          },
        ]);

        expect(player.getPlayedCardInfos(card.name)).to.eql([
          {
            cardName: card.name,
            cardOwnerId: player.playerId,
            workers: [],
            resources: {
              BERRY: 5,
              PEBBLE: 0,
              RESIN: 0,
              TWIG: 0,
            },
            usedForCritter: false,
          },
          {
            cardName: card.name,
            workers: [],
            cardOwnerId: player.playerId,
            resources: {
              BERRY: 0,
              PEBBLE: 0,
              RESIN: 0,
              TWIG: 3,
            },
            usedForCritter: false,
          },
        ]);
      });

      it("should add resources to the correct storehouse", () => {
        const card = Card.fromName(CardName.STOREHOUSE);
        const storehouse1 = player.addToCity(card.name);
        storehouse1.resources![ResourceType.BERRY]! = 5;

        expect(player.getFirstPlayedCard(card.name)).to.eql({
          cardName: card.name,
          cardOwnerId: player.playerId,
          workers: [],
          resources: {
            BERRY: 5,
            PEBBLE: 0,
            RESIN: 0,
            TWIG: 0,
          },
          usedForCritter: false,
        });
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD as const,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(card.name),
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(5);
        expect(player.getFirstPlayedCard(card.name)).to.eql({
          cardName: card.name,
          cardOwnerId: player.playerId,
          workers: [player.playerId],
          resources: {
            BERRY: 0,
            PEBBLE: 0,
            RESIN: 0,
            TWIG: 0,
          },
          usedForCritter: false,
        });
      });

      it("should allow multiple CHIP_SWEEP to add resources to same correct storehouse", () => {
        player.addToCity(CardName.CHIP_SWEEP);
        player.addToCity(CardName.CHIP_SWEEP);
        player.addToCity(CardName.STOREHOUSE);

        // Use up all workers
        gameState.locationsMap[LocationName.BASIC_TWO_CARDS_AND_ONE_VP]!.push(
          player.playerId,
          player.playerId
        );
        player.placeWorkerOnLocation(LocationName.BASIC_TWO_CARDS_AND_ONE_VP);
        player.placeWorkerOnLocation(LocationName.BASIC_TWO_CARDS_AND_ONE_VP);

        [player, gameState] = multiStepGameInputTest(
          gameState,
          [
            { inputType: GameInputType.PREPARE_FOR_SEASON },
            {
              inputType: GameInputType.SELECT_PLAYED_CARDS,
              prevInputType: GameInputType.PREPARE_FOR_SEASON,
              cardOptions: [player.getFirstPlayedCard(CardName.STOREHOUSE)],
              cardContext: CardName.CHIP_SWEEP,
              maxToSelect: 1,
              minToSelect: 1,
              clientOptions: {
                selectedCards: [player.getFirstPlayedCard(CardName.STOREHOUSE)],
              },
            },
            {
              inputType: GameInputType.SELECT_OPTION_GENERIC,
              prevInputType: GameInputType.PREPARE_FOR_SEASON,
              cardContext: CardName.STOREHOUSE,
              playedCardContext: player.getFirstPlayedCard(CardName.STOREHOUSE),
              options: ["3 TWIG", "2 RESIN", "1 PEBBLE", "2 BERRY"],
              clientOptions: { selectedOption: "3 TWIG" },
            },
            {
              inputType: GameInputType.SELECT_PLAYED_CARDS,
              prevInputType: GameInputType.PREPARE_FOR_SEASON,
              cardOptions: [
                {
                  ...player.getFirstPlayedCard(CardName.STOREHOUSE),
                  resources: {
                    [ResourceType.TWIG]: 3,
                    [ResourceType.RESIN]: 0,
                    [ResourceType.PEBBLE]: 0,
                    [ResourceType.BERRY]: 0,
                  },
                },
              ],
              cardContext: CardName.CHIP_SWEEP,
              maxToSelect: 1,
              minToSelect: 1,
              clientOptions: {
                selectedCards: [
                  {
                    ...player.getFirstPlayedCard(CardName.STOREHOUSE),
                    resources: {
                      [ResourceType.TWIG]: 3,
                      [ResourceType.RESIN]: 0,
                      [ResourceType.PEBBLE]: 0,
                      [ResourceType.BERRY]: 0,
                    },
                  },
                ],
              },
            },
            {
              inputType: GameInputType.SELECT_OPTION_GENERIC,
              prevInputType: GameInputType.SELECT_PLAYED_CARDS,
              cardContext: CardName.STOREHOUSE,
              playedCardContext: {
                ...player.getFirstPlayedCard(CardName.STOREHOUSE),
                resources: {
                  [ResourceType.TWIG]: 3,
                  [ResourceType.RESIN]: 0,
                  [ResourceType.PEBBLE]: 0,
                  [ResourceType.BERRY]: 0,
                },
              },
              options: ["3 TWIG", "2 RESIN", "1 PEBBLE", "2 BERRY"],
              clientOptions: { selectedOption: "3 TWIG" },
            },
            {
              inputType: GameInputType.SELECT_OPTION_GENERIC,
              prevInputType: GameInputType.SELECT_PLAYED_CARDS,
              cardContext: CardName.STOREHOUSE,
              playedCardContext: {
                ...player.getFirstPlayedCard(CardName.STOREHOUSE),
                resources: {
                  [ResourceType.TWIG]: 6,
                  [ResourceType.RESIN]: 0,
                  [ResourceType.PEBBLE]: 0,
                  [ResourceType.BERRY]: 0,
                },
              },
              options: ["3 TWIG", "2 RESIN", "1 PEBBLE", "2 BERRY"],
              clientOptions: { selectedOption: "3 TWIG" },
            },
          ],
          { skipMultiPendingInputCheck: true }
        );

        expect(player.getFirstPlayedCard(CardName.STOREHOUSE)).to.eql({
          cardOwnerId: player.playerId,
          cardName: CardName.STOREHOUSE,
          usedForCritter: false,
          workers: [],
          resources: { TWIG: 9, RESIN: 0, PEBBLE: 0, BERRY: 0 },
        });
      });

      it("should give player resources after visiting the storehouse", () => {
        const card = Card.fromName(CardName.STOREHOUSE);
        const storehouse = player.addToCity(card.name);
        storehouse.resources![ResourceType.BERRY]! = 5;

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD as const,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(card.name),
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(5);
        expect(player.getFirstPlayedCard(card.name)).to.eql({
          cardName: card.name,
          workers: [player.playerId],
          cardOwnerId: player.playerId,
          resources: {
            BERRY: 0,
            PEBBLE: 0,
            RESIN: 0,
            TWIG: 0,
          },
          usedForCritter: false,
        });

        gameState.nextPlayer();

        expect(() => {
          multiStepGameInputTest(gameState, [
            {
              inputType: GameInputType.VISIT_DESTINATION_CARD as const,
              clientOptions: {
                playedCard: player.getFirstPlayedCard(card.name),
              },
            },
          ]);
        }).to.throwException(/cannot place worker on card/i);
      });
    });

    describe(CardName.TEACHER, () => {
      it("allow player to give cards to other player using teacher", () => {
        let player1 = gameState.players[0];
        let player2 = gameState.players[1];
        const card = Card.fromName(CardName.TEACHER);

        const topOfDeck = [CardName.FARM, CardName.QUEEN];
        topOfDeck.reverse();
        topOfDeck.forEach((cardName) => {
          gameState.deck.addToStack(cardName);
        });

        // Make sure we can play this card
        player1.gainResources(card.baseCost);
        player1.addCardToHand(gameState, card.name);

        expect(player1.cardsInHand.length).to.be(1);
        expect(player2.cardsInHand.length).to.be(0);

        const selectCardInput = {
          inputType: GameInputType.SELECT_CARDS as const,
          prevInputType: GameInputType.PLAY_CARD,
          cardContext: CardName.TEACHER,
          cardOptions: [CardName.FARM, CardName.QUEEN],
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: [CardName.FARM],
          },
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          selectCardInput,
          {
            inputType: GameInputType.SELECT_PLAYER,
            prevInputType: GameInputType.SELECT_CARDS,
            prevInput: selectCardInput,
            playerOptions: [player2.playerId],
            mustSelectOne: true,
            cardContext: CardName.TEACHER,
            clientOptions: {
              selectedPlayer: player2.playerId,
            },
          },
        ]);

        player1 = gameState.getPlayer(player1.playerId);
        player2 = gameState.getPlayer(player2.playerId);

        expect(player1.cardsInHand).to.eql([CardName.FARM]);

        expect(player2.cardsInHand).to.eql([CardName.QUEEN]);
      });
    });

    describe(CardName.THEATRE, () => {
      it("worth 1 extra VP per unique critter", () => {
        const card = Card.fromName(CardName.THEATRE);
        player.addToCity(card.name);
        const playerId = player.playerId;

        expect(card.getPoints(gameState, playerId)).to.be(3 + 0);

        player.addToCity(CardName.DUNGEON);
        expect(card.getPoints(gameState, playerId)).to.be(3 + 0);

        player.addToCity(CardName.RANGER);
        expect(card.getPoints(gameState, playerId)).to.be(3 + 1);

        player.addToCity(CardName.HUSBAND);
        expect(card.getPoints(gameState, playerId)).to.be(3 + 1);

        player.addToCity(CardName.WANDERER);
        expect(card.getPoints(gameState, playerId)).to.be(3 + 1);

        player.addToCity(CardName.BARD);
        expect(card.getPoints(gameState, playerId)).to.be(3 + 2);
      });
    });

    describe(CardName.TWIG_BARGE, () => {
      it("gain 2 TWIG when played", () => {
        const card = Card.fromName(CardName.TWIG_BARGE);
        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
        ]);

        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
        expect(player.hasCardInCity(card.name)).to.be(true);
      });
    });

    describe(CardName.UNDERTAKER, () => {
      it("should allow player to take card from meadow", () => {
        const cards = [
          CardName.KING,
          CardName.QUEEN,
          CardName.POSTAL_PIGEON,
          CardName.POSTAL_PIGEON,
          CardName.FARM,
          CardName.HUSBAND,
          CardName.CHAPEL,
          CardName.MONK,
        ];
        gameState = testInitialGameState({ meadowCards: cards });
        let player = gameState.getActivePlayer();
        const topOfDeck = [
          CardName.SCHOOL,
          CardName.TEACHER,
          CardName.WIFE,
          CardName.DOCTOR,
        ];
        topOfDeck.reverse();
        topOfDeck.forEach((cardName) => {
          gameState.deck.addToStack(cardName);
        });

        const card = Card.fromName(CardName.UNDERTAKER);

        expect(player.cardsInHand).to.eql([]);
        expect(gameState.meadowCards.indexOf(CardName.DOCTOR)).to.be.lessThan(
          0
        );

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.cardsInHand.push(card.name);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.UNDERTAKER,
            cardOptions: [
              CardName.KING,
              CardName.QUEEN,
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.CHAPEL,
              CardName.MONK,
            ],
            maxToSelect: 3,
            minToSelect: 3,
            clientOptions: {
              selectedCards: [CardName.QUEEN, CardName.KING, CardName.CHAPEL],
            },
          },
          {
            inputType: GameInputType.SELECT_CARDS,
            prevInputType: GameInputType.SELECT_CARDS,
            cardContext: card.name,
            cardOptions: [
              CardName.POSTAL_PIGEON,
              CardName.POSTAL_PIGEON,
              CardName.FARM,
              CardName.HUSBAND,
              CardName.MONK,
              CardName.SCHOOL,
              CardName.TEACHER,
              CardName.WIFE,
            ],
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [CardName.TEACHER],
            },
          },
        ]);

        expect(player.cardsInHand).to.eql([CardName.TEACHER]);
        expect(
          gameState.meadowCards.indexOf(CardName.DOCTOR)
        ).to.be.greaterThan(0);
      });
    });

    describe(CardName.UNIVERSITY, () => {
      it("should allow player remove card from city with university", () => {
        player.addToCity(CardName.UNIVERSITY);
        player.addToCity(CardName.FARM);
        player.addToCity(CardName.CHAPEL);
        player.addToCity(CardName.MONK);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
        expect(player.hasCardInCity(CardName.FARM)).to.be(true);

        const selectPlayedCardInput = {
          inputType: GameInputType.SELECT_PLAYED_CARDS as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD,
          cardContext: CardName.UNIVERSITY,
          cardOptions: player
            .getAllPlayedCards()
            .filter(({ cardName }) => cardName !== CardName.UNIVERSITY),
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: [player.getFirstPlayedCard(CardName.FARM)],
          },
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.UNIVERSITY),
            },
          },
          selectPlayedCardInput,
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInput: selectPlayedCardInput,
            cardContext: CardName.UNIVERSITY,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.BERRY,
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(1);
        expect(player.hasCardInCity(CardName.FARM)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(1);
      });

      it("remove card with non-permanently placed worker on it", () => {
        player.addToCity(CardName.UNIVERSITY);
        player.addToCity(CardName.LOOKOUT);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
        player.placeWorkerOnCard(
          gameState,
          player.getFirstPlayedCard(CardName.LOOKOUT)
        );
        expect(player.numAvailableWorkers).to.be(1);

        const selectPlayedCardInput = {
          inputType: GameInputType.SELECT_PLAYED_CARDS as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD,
          cardContext: CardName.UNIVERSITY,
          cardOptions: player
            .getAllPlayedCards()
            .filter(({ cardName }) => cardName !== CardName.UNIVERSITY),
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            // these are the cards the player wants to remove
            // from their city
            selectedCards: [...player.getPlayedCardInfos(CardName.LOOKOUT)],
          },
        };

        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.UNIVERSITY),
            },
          },
          selectPlayedCardInput,
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInput: selectPlayedCardInput,
            cardContext: CardName.UNIVERSITY,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.BERRY,
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(0);
        expect(player.hasCardInCity(CardName.LOOKOUT)).to.be(false);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(1);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(1);
        player.recallWorkers(gameState);
        expect(player.numAvailableWorkers).to.be(2);
      });

      it("remove card with another player's worker on it", () => {
        let player1 = gameState.getActivePlayer();
        let player2 = gameState.players[1];

        player1.addToCity(CardName.UNIVERSITY);
        player1.addToCity(CardName.INN);
        player2.addToCity(CardName.LOOKOUT);

        expect(player1.numAvailableWorkers).to.be(2);
        expect(player2.numAvailableWorkers).to.be(2);
        expect(player1.getNumResourcesByType(ResourceType.VP)).to.be(0);
        player2.placeWorkerOnCard(
          gameState,
          player1.getFirstPlayedCard(CardName.INN)
        );
        player2.placeWorkerOnCard(
          gameState,
          player2.getFirstPlayedCard(CardName.LOOKOUT)
        );
        expect(player2.numAvailableWorkers).to.be(0);

        const selectPlayedCardInput = {
          inputType: GameInputType.SELECT_PLAYED_CARDS as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD,
          cardContext: CardName.UNIVERSITY,
          cardOptions: player1
            .getAllPlayedCards()
            .filter(({ cardName }) => cardName !== CardName.UNIVERSITY),
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: [...player1.getPlayedCardInfos(CardName.INN)],
          },
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player1.getFirstPlayedCard(CardName.UNIVERSITY),
            },
          },
          selectPlayedCardInput,
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInput: selectPlayedCardInput,
            cardContext: CardName.UNIVERSITY,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.TWIG,
            },
          },
        ]);
        player1 = gameState.getPlayer(player1.playerId);
        player2 = gameState.getPlayer(player2.playerId);

        player2.recallWorkers(gameState);
        expect(player2.numAvailableWorkers).to.be(2);
      });

      it("remove card with permanently placed worker on it", () => {
        player.addToCity(CardName.UNIVERSITY);
        player.addToCity(CardName.MONASTERY);

        expect(player.numAvailableWorkers).to.be(2);
        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
        player.placeWorkerOnCard(
          gameState,
          player.getFirstPlayedCard(CardName.MONASTERY)
        );
        expect(player.numAvailableWorkers).to.be(1);

        const selectPlayedCardInput = {
          inputType: GameInputType.SELECT_PLAYED_CARDS as const,
          prevInputType: GameInputType.VISIT_DESTINATION_CARD,
          cardContext: CardName.UNIVERSITY,
          cardOptions: player
            .getAllPlayedCards()
            .filter(({ cardName }) => cardName !== CardName.UNIVERSITY),
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            // these are the cards the player wants to remove
            // from their city
            selectedCards: [...player.getPlayedCardInfos(CardName.MONASTERY)],
          },
        };

        [player, gameState] = multiStepGameInputTest(gameState, [
          {
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: {
              playedCard: player.getFirstPlayedCard(CardName.UNIVERSITY),
            },
          },
          selectPlayedCardInput,
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInput: selectPlayedCardInput,
            cardContext: CardName.UNIVERSITY,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.TWIG,
            },
          },
        ]);

        expect(player.numAvailableWorkers).to.be(0);
        player.recallWorkers(gameState);
        expect(player.numAvailableWorkers).to.be(1);
      });
    });

    describe(CardName.WANDERER, () => {
      it("should gain 3 cards when played", () => {
        const card = Card.fromName(CardName.WANDERER);
        const gameInput = playCardInput(card.name);

        gameState.deck.addToStack(CardName.FARM);
        gameState.deck.addToStack(CardName.FARM);
        gameState.deck.addToStack(CardName.FARM);

        player.cardsInHand.push(card.name);
        player.gainResources(card.baseCost);
        expect(player.cardsInHand).to.eql([card.name]);

        [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);
        expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
        expect(player.cardsInHand).to.eql([
          CardName.FARM,
          CardName.FARM,
          CardName.FARM,
        ]);
      });
    });

    describe(CardName.WIFE, () => {
      it("should be worth 3 points when paired with HUSBAND", () => {
        expect(player.getPointsFromCards(gameState)).to.be(0);

        player.addToCity(CardName.WIFE);
        expect(player.getPointsFromCards(gameState)).to.be(2);

        player.addToCity(CardName.WIFE);
        expect(player.getPointsFromCards(gameState)).to.be(4);

        player.addToCity(CardName.HUSBAND);
        expect(player.getPointsFromCards(gameState)).to.be(6 + 3);

        player.addToCity(CardName.HUSBAND);
        expect(player.getPointsFromCards(gameState)).to.be(8 + 3 + 3);

        player.addToCity(CardName.HUSBAND);
        expect(player.getPointsFromCards(gameState)).to.be(10 + 3 + 3);
      });
    });

    describe(CardName.WOODCARVER, () => {
      it("should not prompt player if they don't have any twigs", () => {
        const card = Card.fromName(CardName.WOODCARVER);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        player.addCardToHand(gameState, card.name);

        [player, gameState] = multiStepGameInputTest(
          gameState,
          [playCardInput(card.name)],
          { autoAdvance: true }
        );

        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(0);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      });

      it("should allow player to pay up to 3 twig for vp", () => {
        const card = Card.fromName(CardName.WOODCARVER);

        // Make sure we can play this card
        player.gainResources(card.baseCost);
        // Make sure we can spend for vp
        player.gainResources({ [ResourceType.TWIG]: 3 });
        player.addCardToHand(gameState, card.name);

        [player, gameState] = multiStepGameInputTest(gameState, [
          playCardInput(card.name),
          {
            inputType: GameInputType.SELECT_RESOURCES,
            toSpend: true,
            prevInputType: GameInputType.PLAY_CARD,
            cardContext: CardName.WOODCARVER,
            specificResource: ResourceType.TWIG,
            minResources: 0,
            maxResources: 3,
            clientOptions: {
              resources: {
                [ResourceType.TWIG]: 3,
              },
            },
          },
        ]);

        expect(player.getNumResourcesByType(ResourceType.VP)).to.be(3);
        expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      });
    });
  });
});
