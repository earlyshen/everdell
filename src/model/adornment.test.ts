import expect from "expect.js";
import { Adornment } from "./adornment";
import { Player } from "./player";
import { GameState } from "./gameState";
import { testInitialGameState, multiStepGameInputTest } from "./testHelpers";
import {
  AdornmentName,
  ExpansionType,
  LocationName,
  GameInputType,
  GameInputPlayAdornment,
  CardName,
  CardType,
  EventName,
  ResourceType,
} from "./types";

const playAdornmentInput = (
  adornment: AdornmentName
): GameInputPlayAdornment => {
  return {
    inputType: GameInputType.PLAY_ADORNMENT,
    clientOptions: {
      adornment,
    },
  };
};

describe("Adornment", () => {
  let gameState: GameState;
  let player: Player;

  beforeEach(() => {
    gameState = testInitialGameState();
    player = gameState.getActivePlayer();
  });

  describe("fromName", () => {
    it("should return the expect Adornment instances", () => {
      Object.values(AdornmentName).forEach((adt) => {
        expect(Adornment.fromName(adt as AdornmentName).name).to.be(adt);
      });
    });
  });

  describe(AdornmentName.SPYGLASS, () => {
    const name = AdornmentName.SPYGLASS;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be worth 3 points for each wonder", () => {
      player.playedAdornments.push(name);
      player.nextSeason();
      player.nextSeason();
      player.nextSeason();

      // worth 0 because no wonders built
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.placeWorkerOnEvent(EventName.SPECIAL_GRADUATION_OF_SCHOLARS);
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.placeWorkerOnEvent(EventName.WONDER_SUNBLAZE_BRIDGE);
      expect(player.getPointsFromAdornments(gameState)).to.be(3);

      player.placeWorkerOnEvent(EventName.WONDER_STARFALLS_FLAME);
      expect(player.getPointsFromAdornments(gameState)).to.be(6);
    });

    it("should gain 1 ANY, CARD and PEARL", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);

      expect(player.cardsInHand.length).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_OPTION_GENERIC,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: name,
          options: [
            ResourceType.BERRY,
            ResourceType.TWIG,
            ResourceType.RESIN,
            ResourceType.PEBBLE,
          ],
          clientOptions: {
            selectedOption: ResourceType.PEBBLE,
          },
        },
      ]);

      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
      expect(player.cardsInHand.length).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
    });
  });

  describe(AdornmentName.SCALES, () => {
    const name = AdornmentName.SCALES;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be able to play and gain resources", () => {
      const adornment = Adornment.fromName(name);
      const gameInput = playAdornmentInput(name);

      expect(adornment.canPlay(gameState, gameInput)).to.be(true);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      player.cardsInHand.push(CardName.WIFE);
      player.cardsInHand.push(CardName.FARM);
      player.cardsInHand.push(CardName.HUSBAND);
      player.cardsInHand.push(CardName.POSTAL_PIGEON);
      player.cardsInHand.push(CardName.INN);
      player.cardsInHand.push(CardName.INNKEEPER);
      player.cardsInHand.push(CardName.QUEEN);

      const selectCardsInput = {
        inputType: GameInputType.SELECT_CARDS as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        cardOptions: player.cardsInHand,
        maxToSelect: 4,
        minToSelect: 0,
        clientOptions: {
          selectedCards: [
            CardName.INN,
            CardName.POSTAL_PIGEON,
            CardName.FARM,
            CardName.WIFE,
          ],
        },
      };

      const selectAnyInput = {
        inputType: GameInputType.SELECT_RESOURCES as const,
        prevInputType: GameInputType.SELECT_CARDS,
        adornmentContext: name,
        toSpend: false,
        maxResources: 4,
        minResources: 4,
        clientOptions: {
          resources: { [ResourceType.BERRY]: 3, [ResourceType.TWIG]: 1 },
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        gameInput,
        selectCardsInput,
        selectAnyInput,
      ]);

      expect(adornment.canPlay(gameState, gameInput)).to.be(false);

      player = gameState.getPlayer(player.playerId);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(1);
      expect(player.cardsInHand).to.eql([
        CardName.HUSBAND,
        CardName.INNKEEPER,
        CardName.QUEEN,
      ]);
      expect(player.getPoints(gameState)).to.be(3);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("should not gain resources if didn't discard cards", () => {
      const adornment = Adornment.fromName(name);
      const gameInput = playAdornmentInput(name);

      expect(adornment.canPlay(gameState, gameInput)).to.be(true);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      player.cardsInHand.push(CardName.WIFE);
      player.cardsInHand.push(CardName.FARM);
      player.cardsInHand.push(CardName.HUSBAND);
      player.cardsInHand.push(CardName.POSTAL_PIGEON);
      player.cardsInHand.push(CardName.INN);
      player.cardsInHand.push(CardName.INNKEEPER);
      player.cardsInHand.push(CardName.QUEEN);

      const selectCardsInput = {
        inputType: GameInputType.SELECT_CARDS as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        cardOptions: player.cardsInHand,
        maxToSelect: 4,
        minToSelect: 0,
        clientOptions: {
          selectedCards: [],
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        gameInput,
        selectCardsInput,
      ]);

      expect(adornment.canPlay(gameState, gameInput)).to.be(false);

      player = gameState.getPlayer(player.playerId);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);
      expect(player.cardsInHand).to.eql([
        CardName.WIFE,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.POSTAL_PIGEON,
        CardName.INN,
        CardName.INNKEEPER,
        CardName.QUEEN,
      ]);
      expect(player.getPoints(gameState)).to.be(5);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("should calculate points correctly", () => {
      player.playedAdornments.push(name);

      let testHand = [CardName.WIFE];
      player.cardsInHand.push(...testHand);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.cardsInHand = [];
      testHand = [CardName.WIFE, CardName.FARM];
      player.cardsInHand.push(...testHand);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);

      player.cardsInHand = [];
      testHand = [CardName.WIFE, CardName.FARM, CardName.HUSBAND];
      player.cardsInHand.push(...testHand);
      expect(player.getPointsFromAdornments(gameState)).to.be(3);

      player.cardsInHand = [];
      testHand = [
        CardName.WIFE,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.MONK,
      ];
      player.cardsInHand.push(...testHand);
      expect(player.getPointsFromAdornments(gameState)).to.be(4);

      player.cardsInHand = [];
      testHand = [
        CardName.WIFE,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.MONK,
        CardName.QUEEN,
      ];
      player.cardsInHand.push(...testHand);
      // max 5 points from adornment
      expect(player.getPointsFromAdornments(gameState)).to.be(5);

      player.cardsInHand = [];
      testHand = [
        CardName.WIFE,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.MONK,
        CardName.QUEEN,
        CardName.KING,
      ];
      player.cardsInHand.push(...testHand);
      // max 5 points from adornment
      expect(player.getPointsFromAdornments(gameState)).to.be(5);

      player.cardsInHand = [];
      testHand = [
        CardName.WIFE,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.MONK,
        CardName.QUEEN,
        CardName.KING,
        CardName.POSTAL_PIGEON,
      ];
      player.cardsInHand.push(...testHand);
      // max 5 points from adornment
      expect(player.getPointsFromAdornments(gameState)).to.be(5);

      testHand = [
        CardName.WIFE,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.MONK,
        CardName.QUEEN,
        CardName.KING,
        CardName.POSTAL_PIGEON,
        CardName.INN,
      ];
      player.cardsInHand.push(...testHand);

      // max 5 points from adornment
      expect(player.getPointsFromAdornments(gameState)).to.be(5);
    });
  });

  describe(AdornmentName.MIRROR, () => {
    const name = AdornmentName.MIRROR;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should play MIRROR and copy BELL", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      const player2 = gameState.players[1];
      player.addToCity(CardName.WIFE);

      player2.playedAdornments.push(AdornmentName.BELL);
      player2.playedAdornments.push(AdornmentName.GILDED_BOOK);

      const selectAdornmentInput = {
        inputType: GameInputType.SELECT_PLAYED_ADORNMENT as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        adornmentOptions: [AdornmentName.BELL, AdornmentName.GILDED_BOOK],
        maxToSelect: 1,
        minToSelect: 0,
        mustSelectFromOpponents: true,
        clientOptions: {
          // let's do bell because it's easy
          adornment: [AdornmentName.BELL],
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectAdornmentInput,
      ]);

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.cardsInHand.length).to.be(1);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("should play MIRROR and copy HOURGLASS", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      gameState.locationsMap[LocationName.FOREST_TWO_BERRY_ONE_CARD] = [];
      gameState.locationsMap[LocationName.FOREST_THREE_BERRY] = [];
      const player2 = gameState.players[1];
      player.addToCity(CardName.WIFE);
      player.addToCity(CardName.INN);

      player2.playedAdornments.push(AdornmentName.BELL);
      player2.playedAdornments.push(AdornmentName.HOURGLASS);

      const selectAdornmentInput = {
        inputType: GameInputType.SELECT_PLAYED_ADORNMENT as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        adornmentOptions: [AdornmentName.BELL, AdornmentName.HOURGLASS],
        maxToSelect: 1,
        minToSelect: 0,
        mustSelectFromOpponents: true,
        clientOptions: {
          adornment: [AdornmentName.HOURGLASS],
        },
      };

      [player, gameState] = multiStepGameInputTest(
        gameState,
        [
          playAdornmentInput(name),
          selectAdornmentInput,
          {
            inputType: GameInputType.SELECT_LOCATION,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            adornmentContext: AdornmentName.HOURGLASS,
            locationOptions: [
              LocationName.FOREST_TWO_BERRY_ONE_CARD,
              LocationName.FOREST_THREE_BERRY,
            ],
            clientOptions: {
              selectedLocation: LocationName.FOREST_THREE_BERRY,
            },
          },
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            adornmentContext: AdornmentName.HOURGLASS,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.PEBBLE,
            },
          },
        ],
        { skipMultiPendingInputCheck: true }
      );

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("MIRROR is still playable even if no adornments to copy", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      const player2 = gameState.players[1];
      player.addToCity(CardName.WIFE);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
      ]);

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("Allow player to play MIRROR without selecting a played adornment", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      const player2 = gameState.players[1];
      player.addToCity(CardName.WIFE);

      player2.playedAdornments.push(AdornmentName.BELL);
      player2.playedAdornments.push(AdornmentName.GILDED_BOOK);

      const selectAdornmentInput = {
        inputType: GameInputType.SELECT_PLAYED_ADORNMENT as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        adornmentOptions: [AdornmentName.BELL, AdornmentName.GILDED_BOOK],
        maxToSelect: 1,
        minToSelect: 0,
        mustSelectFromOpponents: true,
        clientOptions: {
          adornment: [],
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectAdornmentInput,
      ]);

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("Should calculate points correctly", () => {
      player.playedAdornments.push(name);
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.addToCity(CardName.FARM);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.FARM);
      // still 1, because didn't add another unique color
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.INN);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);

      player.addToCity(CardName.HUSBAND);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);

      player.addToCity(CardName.WIFE);
      expect(player.getPointsFromAdornments(gameState)).to.be(3);

      player.addToCity(CardName.UNDERTAKER);
      expect(player.getPointsFromAdornments(gameState)).to.be(4);

      player.addToCity(CardName.EVERTREE);
      expect(player.getPointsFromAdornments(gameState)).to.be(4);

      player.addToCity(CardName.INNKEEPER);
      expect(player.getPointsFromAdornments(gameState)).to.be(5);

      player.addToCity(CardName.HISTORIAN);
      expect(player.getPointsFromAdornments(gameState)).to.be(5);
    });
  });

  describe(AdornmentName.KEY_TO_THE_CITY, () => {
    const name = AdornmentName.KEY_TO_THE_CITY;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be able to play", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.POST_OFFICE);

      const selectResourcesInput = {
        inputType: GameInputType.SELECT_RESOURCES as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        toSpend: false,
        maxResources: 2,
        minResources: 2,
        clientOptions: {
          resources: { [ResourceType.BERRY]: 1, [ResourceType.TWIG]: 1 },
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectResourcesInput,
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
      expect(player.cardsInHand.length).to.be(2);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("should calculate points correctly", () => {
      player.playedAdornments.push(name);

      // worth 0 because no constructions
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.addToCity(CardName.FARM);

      // still 0 because only 1 construction
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.addToCity(CardName.MONASTERY);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.HUSBAND);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.INN);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.CASTLE);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);
    });
  });

  describe(AdornmentName.SUNDIAL, () => {
    const name = AdornmentName.SUNDIAL;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be worth 2 point for every 2 PRODUCTION", () => {
      const adornment = Adornment.fromName(name);
      const playerId = player.playerId;
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.FARM);
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.FARM);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.QUEEN);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.KING);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.MINE);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.MINER_MOLE);
      expect(adornment.getPoints(gameState, playerId)).to.be(2);
    });

    it("should do nothing if player has no production cards", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should not ask to choose if player has less than 3 production cards", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

      player.addToCity(CardName.MINE);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.FARM);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
    });

    it("should ask to choose if player has more than 3 production cards", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

      player.addToCity(CardName.MINE);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.FARM);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_PLAYED_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: AdornmentName.SUNDIAL,
          cardOptions: player.getAllPlayedCardsByType(CardType.PRODUCTION),
          maxToSelect: 3,
          minToSelect: 3,
          clientOptions: {
            selectedCards: [
              player.getFirstPlayedCard(CardName.MINE),
              ...player.getPlayedCardInfos(CardName.FARM).slice(0, 2),
            ],
          },
        },
      ]);

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
    });

    it("should ask to choose if player has more than 3 production cards (all farms)", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

      player.addToCity(CardName.MINE);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.FARM);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_PLAYED_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: AdornmentName.SUNDIAL,
          cardOptions: player.getAllPlayedCardsByType(CardType.PRODUCTION),
          maxToSelect: 3,
          minToSelect: 3,
          clientOptions: {
            selectedCards: [...player.getPlayedCardInfos(CardName.FARM)],
          },
        },
      ]);

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);
    });

    it("should work with MINER_MOLE and CHIP_SWEEP", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

      player.addToCity(CardName.MINE);
      player.addToCity(CardName.CHIP_SWEEP);
      player.addToCity(CardName.FARM);
      player.addToCity(CardName.MINER_MOLE);

      gameState.players[1].addToCity(CardName.FARM);

      [player, gameState] = multiStepGameInputTest(
        gameState,
        [
          playAdornmentInput(name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            adornmentContext: AdornmentName.SUNDIAL,
            cardOptions: player.getAllPlayedCardsByType(CardType.PRODUCTION),
            maxToSelect: 3,
            minToSelect: 3,
            clientOptions: {
              selectedCards: [
                player.getFirstPlayedCard(CardName.MINE),
                player.getFirstPlayedCard(CardName.MINER_MOLE),
                player.getFirstPlayedCard(CardName.CHIP_SWEEP),
              ],
            },
          },
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.SELECT_PLAYED_CARDS,
            cardContext: CardName.CHIP_SWEEP,
            cardOptions: player
              .getAllPlayedCardsByType(CardType.PRODUCTION)
              .filter(({ cardName }) => cardName !== CardName.CHIP_SWEEP),
            maxToSelect: 1,
            minToSelect: 1,
            clientOptions: {
              selectedCards: [player.getFirstPlayedCard(CardName.MINE)],
            },
          },
        ],
        { skipMultiPendingInputCheck: true, autoAdvance: true }
      );

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(2);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(1);
    });
  });

  describe(AdornmentName.GILDED_BOOK, () => {
    const name = AdornmentName.GILDED_BOOK;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should allow the player to gain resources equal to the cost of one GOVERNANCE", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCityMulti([
        CardName.FARM,
        CardName.DUNGEON,
        CardName.CLOCK_TOWER,
        CardName.INNKEEPER,
      ]);

      const selectCardInput = {
        inputType: GameInputType.SELECT_CARDS as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        // FARM not included because not a Governance
        cardOptions: [
          CardName.DUNGEON,
          CardName.CLOCK_TOWER,
          CardName.INNKEEPER,
        ],
        maxToSelect: 1,
        minToSelect: 1,
        clientOptions: {
          selectedCards: [CardName.DUNGEON],
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectCardInput,
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(2);
      expect(player.getPointsFromAdornments(gameState)).to.be(3);
      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
    });

    it("should be worth 1 point for every 2 GOVERNANCE", () => {
      player.playedAdornments.push(name);
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.addToCity(CardName.FARM);
      expect(player.getPointsFromAdornments(gameState)).to.be(0);

      player.addToCity(CardName.DUNGEON);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.HUSBAND);
      expect(player.getPointsFromAdornments(gameState)).to.be(1);

      player.addToCity(CardName.INNKEEPER);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);

      player.addToCity(CardName.CLOCK_TOWER);
      expect(player.getPointsFromAdornments(gameState)).to.be(3);

      player.addToCity(CardName.POSTAL_PIGEON);
      expect(player.getPointsFromAdornments(gameState)).to.be(3);

      player.addToCity(CardName.HISTORIAN);
      expect(player.getPointsFromAdornments(gameState)).to.be(4);
    });
  });

  describe(AdornmentName.SEAGLASS_AMULET, () => {
    const name = AdornmentName.SEAGLASS_AMULET;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be able to play", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);

      expect(player.cardsInHand.length).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);

      const selectAnyInput = {
        inputType: GameInputType.SELECT_RESOURCES as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
        toSpend: false,
        maxResources: 3,
        minResources: 3,
        clientOptions: {
          resources: {
            [ResourceType.PEBBLE]: 1,
            [ResourceType.RESIN]: 1,
            [ResourceType.TWIG]: 1,
          },
        },
      };

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectAnyInput,
      ]);

      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
      expect(player.cardsInHand.length).to.be(2);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.RESIN)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.VP)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);

      // always worth 3 points
      expect(player.getPointsFromAdornments(gameState)).to.be(3);
    });
  });

  describe(AdornmentName.MASQUE, () => {
    const name = AdornmentName.MASQUE;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be worth 1 point for every 3 VP you have", () => {
      const adornment = Adornment.fromName(name);
      const playerId = player.playerId;
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.gainResources({ [ResourceType.VP]: 1 });
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.gainResources({ [ResourceType.VP]: 1 });
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.gainResources({ [ResourceType.VP]: 1 });
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.gainResources({ [ResourceType.VP]: 7 });
      expect(adornment.getPoints(gameState, playerId)).to.be(1 + 2);

      player.gainResources({ [ResourceType.VP]: 7 });
      expect(adornment.getPoints(gameState, playerId)).to.be(1 + 4);

      player.gainResources({ [ResourceType.VP]: 7 });
      expect(adornment.getPoints(gameState, playerId)).to.be(1 + 7);
    });

    it("should allow player to choose to play card from meadow OR hand", () => {
      gameState.meadowCards.push(CardName.FARM);
      player.cardsInHand.push(CardName.FARM);
      expect(player.hasCardInCity(CardName.FARM)).to.be(false);

      const selectCardInput = {
        inputType: GameInputType.SELECT_CARDS as const,
        prevInputType: GameInputType.PLAY_ADORNMENT,
        adornmentContext: name,
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
        adornmentContext: name,
        options: ["Meadow", "Hand"],
        clientOptions: { selectedOption: "Meadow" },
      };

      const selectCardFromHandSourceInput = {
        inputType: GameInputType.SELECT_OPTION_GENERIC as const,
        prevInputType: GameInputType.SELECT_CARDS,
        prevInput: selectCardInput,
        adornmentContext: name,
        options: ["Meadow", "Hand"],
        clientOptions: { selectedOption: "Hand" },
      };

      const [playerMeadow, gameState2] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectCardInput,
        selectCardFromMeadowSourceInput,
      ]);

      expect(gameState2.meadowCards.indexOf(CardName.FARM)).to.be(-1);
      expect(playerMeadow.cardsInHand.indexOf(CardName.FARM)).to.be(0);
      expect(playerMeadow.hasCardInCity(CardName.FARM)).to.be(true);

      const [playerHand, gameState3] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        selectCardInput,
        selectCardFromHandSourceInput,
      ]);

      expect(gameState3.meadowCards.indexOf(CardName.FARM)).to.be(0);
      expect(playerHand.cardsInHand.indexOf(CardName.FARM)).to.be(-1);
      expect(playerHand.hasCardInCity(CardName.FARM)).to.be(true);
    });

    it("should allow player to buy card from hand for less than 3 points for free", () => {
      player.cardsInHand.push(CardName.HUSBAND);
      expect(player.hasCardInCity(CardName.HUSBAND)).to.be(false);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: name,
          cardOptions: [CardName.HUSBAND],
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: [CardName.HUSBAND],
          },
        },
      ]);

      expect(player.hasCardInCity(CardName.HUSBAND)).to.be(true);
      expect(player.cardsInHand.indexOf(CardName.HUSBAND)).to.be(-1);
    });

    it("should allow player to play card from the meadow for less than 3 points for free", () => {
      gameState.meadowCards.push(
        CardName.KING,
        CardName.QUEEN,
        CardName.POSTAL_PIGEON,
        CardName.POSTAL_PIGEON,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.CHAPEL,
        CardName.MONK
      );
      expect(player.hasCardInCity(CardName.HUSBAND)).to.be(false);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: name,
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

      expect(player.hasCardInCity(CardName.HUSBAND)).to.be(true);
      expect(gameState.meadowCards.indexOf(CardName.HUSBAND)).to.be(-1);
    });

    it("should allow player to play card worth exactly 3 points for free", () => {
      gameState.meadowCards.push(
        CardName.KING,
        CardName.QUEEN,
        CardName.POSTAL_PIGEON,
        CardName.POSTAL_PIGEON,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.CHAPEL,
        CardName.FAIRGROUNDS
      );
      expect(player.hasCardInCity(CardName.FAIRGROUNDS)).to.be(false);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: name,
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

      expect(gameState.meadowCards.indexOf(CardName.FAIRGROUNDS)).to.be(-1);
      expect(player.hasCardInCity(CardName.FAIRGROUNDS)).to.be(true);
    });

    it("should not allow player to buy card for than 3 points", () => {
      gameState.meadowCards.push(
        CardName.KING,
        CardName.QUEEN,
        CardName.POSTAL_PIGEON,
        CardName.POSTAL_PIGEON,
        CardName.FARM,
        CardName.HUSBAND,
        CardName.CHAPEL,
        CardName.MONK
      );
      gameState = gameState.next(playAdornmentInput(name));

      expect(() => {
        gameState.next({
          inputType: GameInputType.SELECT_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: name,
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
      }).to.throwException(/cannot/i);
    });
  });

  describe(AdornmentName.BELL, () => {
    const name = AdornmentName.BELL;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("can play adornment", () => {
      const adornment = Adornment.fromName(name);
      const gameInput = playAdornmentInput(name);

      expect(adornment.canPlay(gameState, gameInput)).to.be(true);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

      [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);

      expect(adornment.canPlay(gameState, gameInput)).to.be(false);

      player = gameState.getPlayer(player.playerId);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.getPoints(gameState)).to.be(0);
    });

    it("calculate points when city has critters", () => {
      const adornment = Adornment.fromName(name);
      const gameInput = playAdornmentInput(name);

      player.addToCity(CardName.WIFE);
      player.addToCity(CardName.POSTAL_PIGEON);
      player.addToCity(CardName.HUSBAND);
      player.addToCity(CardName.HUSBAND);

      expect(adornment.canPlay(gameState, gameInput)).to.be(true);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

      [player, gameState] = multiStepGameInputTest(gameState, [gameInput]);

      expect(adornment.canPlay(gameState, gameInput)).to.be(false);

      player = gameState.getPlayer(player.playerId);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.getPointsFromAdornments(gameState)).to.be(2);
      expect(player.getPoints(gameState)).to.be(11);
    });

    it("odd number of critters in city", () => {
      player.addToCity(CardName.WIFE);
      player.addToCity(CardName.POSTAL_PIGEON);
      player.addToCity(CardName.HUSBAND);
      player.playedAdornments.push(name);

      expect(player.getPointsFromAdornments(gameState)).to.be(1);
    });
  });

  describe(AdornmentName.HOURGLASS, () => {
    const name = AdornmentName.HOURGLASS;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);

      gameState.locationsMap[LocationName.FOREST_TWO_BERRY_ONE_CARD] = [];
      gameState.locationsMap[LocationName.FOREST_THREE_BERRY] = [];
    });

    it("should be worth 1 point for every 1 DESTINATION", () => {
      const adornment = Adornment.fromName(name);
      const playerId = player.playerId;
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.FARM);
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.QUEEN);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.KING);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.UNIVERSITY);
      expect(adornment.getPoints(gameState, playerId)).to.be(2);

      player.addToCity(CardName.CASTLE);
      expect(adornment.getPoints(gameState, playerId)).to.be(2);
    });

    it("should allow the player to copy a forest location and gain 1 ANY", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);

      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);

      [player, gameState] = multiStepGameInputTest(
        gameState,
        [
          playAdornmentInput(name),
          {
            inputType: GameInputType.SELECT_LOCATION,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            adornmentContext: name,
            locationOptions: [
              LocationName.FOREST_TWO_BERRY_ONE_CARD,
              LocationName.FOREST_THREE_BERRY,
            ],
            clientOptions: {
              selectedLocation: LocationName.FOREST_THREE_BERRY,
            },
          },
          {
            inputType: GameInputType.SELECT_OPTION_GENERIC,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            adornmentContext: name,
            options: [
              ResourceType.BERRY,
              ResourceType.TWIG,
              ResourceType.RESIN,
              ResourceType.PEBBLE,
            ],
            clientOptions: {
              selectedOption: ResourceType.PEBBLE,
            },
          },
        ],
        { skipMultiPendingInputCheck: true }
      );

      expect(player.adornmentsInHand).to.eql([]);
      expect(player.playedAdornments).to.eql([name]);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(3);
      expect(player.getNumResourcesByType(ResourceType.PEBBLE)).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });
  });

  describe(AdornmentName.COMPASS, () => {
    const name = AdornmentName.COMPASS;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should do nothing if no traveller cards", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should ask to reactivate traveller cards and allow none to be selected", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCity(CardName.WANDERER);
      player.addToCity(CardName.WANDERER);

      expect(player.cardsInHand.length).to.be(0);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_PLAYED_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          cardOptions: player.getPlayedCardInfos(CardName.WANDERER),
          adornmentContext: name,
          maxToSelect: 2,
          minToSelect: 0,
          clientOptions: { selectedCards: [] },
        },
      ]);

      expect(player.cardsInHand.length).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should ask to reactivate traveller cards and activate selected cards", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCity(CardName.WANDERER);
      player.addToCity(CardName.WANDERER);

      expect(player.cardsInHand.length).to.be(0);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_PLAYED_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          cardOptions: player.getPlayedCardInfos(CardName.WANDERER),
          adornmentContext: name,
          maxToSelect: 2,
          minToSelect: 0,
          clientOptions: {
            selectedCards: player.getPlayedCardInfos(CardName.WANDERER),
          },
        },
      ]);

      expect(player.cardsInHand.length).to.be(6);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should work for RUINS", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCity(CardName.RUINS);
      player.addToCity(CardName.FARM);

      expect(player.hasCardInCity(CardName.FARM)).to.be(true);
      expect(player.getPlayedCardInfos(CardName.RUINS).length).to.be(1);
      expect(player.cardsInHand.length).to.be(0);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_PLAYED_CARDS,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          cardOptions: player.getPlayedCardInfos(CardName.RUINS),
          adornmentContext: name,
          maxToSelect: 2,
          minToSelect: 0,
          clientOptions: {
            selectedCards: player.getPlayedCardInfos(CardName.RUINS),
          },
        },
        {
          inputType: GameInputType.SELECT_PLAYED_CARDS,
          prevInputType: GameInputType.PLAY_CARD,
          cardOptions: player.getPlayedCardInfos(CardName.FARM),
          playedCardContext: player.getFirstPlayedCard(CardName.RUINS),
          cardContext: CardName.RUINS,
          maxToSelect: 1,
          minToSelect: 1,
          clientOptions: {
            selectedCards: player.getPlayedCardInfos(CardName.FARM),
          },
        },
      ]);

      expect(player.hasCardInCity(CardName.FARM)).to.be(false);
      expect(player.cardsInHand.length).to.be(2);
      expect(player.getPlayedCardInfos(CardName.RUINS).length).to.be(1);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should work for FOOL", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCity(CardName.FOOL);

      let targetPlayer = gameState.players[1];
      expect(player.hasCardInCity(CardName.FOOL)).to.be(true);
      expect(targetPlayer.hasCardInCity(CardName.FOOL)).to.be(false);

      [player, gameState] = multiStepGameInputTest(
        gameState,
        [
          playAdornmentInput(name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            cardOptions: player.getPlayedCardInfos(CardName.FOOL),
            adornmentContext: name,
            maxToSelect: 2,
            minToSelect: 0,
            clientOptions: {
              selectedCards: player.getPlayedCardInfos(CardName.FOOL),
            },
          },
        ],
        { autoAdvance: true }
      );

      targetPlayer = gameState.players[1];
      expect(gameState.discardPile.length).to.be(0);
      expect(player.hasCardInCity(CardName.FOOL)).to.be(false);
      expect(targetPlayer.hasCardInCity(CardName.FOOL)).to.be(true);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should work for RANGER", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCity(CardName.RANGER);

      gameState.locationsMap[LocationName.BASIC_ONE_STONE]!.push(
        player.playerId
      );
      player.placeWorkerOnLocation(LocationName.BASIC_ONE_STONE);

      [player, gameState] = multiStepGameInputTest(
        gameState,
        [
          playAdornmentInput(name),
          {
            inputType: GameInputType.SELECT_PLAYED_CARDS,
            prevInputType: GameInputType.PLAY_ADORNMENT,
            cardOptions: player.getPlayedCardInfos(CardName.RANGER),
            adornmentContext: name,
            maxToSelect: 2,
            minToSelect: 0,
            clientOptions: {
              selectedCards: player.getPlayedCardInfos(CardName.RANGER),
            },
          },
          {
            inputType: GameInputType.SELECT_WORKER_PLACEMENT,
            prevInput: {
              inputType: GameInputType.SELECT_WORKER_PLACEMENT as const,
              label: "Select a deployed worker to move",
              prevInputType: GameInputType.PLAY_CARD,
              cardContext: CardName.RANGER,
              mustSelectOne: true,
              clientOptions: {
                selectedOption: {
                  location: LocationName.BASIC_ONE_STONE,
                },
              },
              options: [{ location: LocationName.BASIC_ONE_STONE }],
            },
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
        ],
        { autoAdvance: true }
      );

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.TWIG)).to.be(2);
    });

    it("should only prompt for reactivatable cards", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      player.addToCity(CardName.FOOL);

      // Both players already have FOOL in their city.
      const targetPlayer = gameState.players[1];
      targetPlayer.addToCity(CardName.FOOL);

      expect(player.hasCardInCity(CardName.FOOL)).to.be(true);
      expect(targetPlayer.hasCardInCity(CardName.FOOL)).to.be(true);

      [player, gameState] = multiStepGameInputTest(
        gameState,
        [playAdornmentInput(name)],
        { autoAdvance: true }
      );

      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });
  });

  describe(AdornmentName.TIARA, () => {
    const name = AdornmentName.TIARA;
    beforeEach(() => {
      player.gainResources({ [ResourceType.PEARL]: 1 });
      player.adornmentsInHand.push(name);
    });

    it("should be worth 1 point for every 1 PROSPERITY", () => {
      const adornment = Adornment.fromName(name);
      const playerId = player.playerId;
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.FARM);
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.QUEEN);
      expect(adornment.getPoints(gameState, playerId)).to.be(0);

      player.addToCity(CardName.KING);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.MINE);
      expect(adornment.getPoints(gameState, playerId)).to.be(1);

      player.addToCity(CardName.CASTLE);
      expect(adornment.getPoints(gameState, playerId)).to.be(2);
    });

    it("should do nothing if no PROSPERITY", () => {
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);
      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
    });

    it("should allow the player to gain ANY per PROSPERITY", () => {
      player.addToCity(CardName.WIFE);
      player.addToCity(CardName.WIFE);

      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(1);

      [player, gameState] = multiStepGameInputTest(gameState, [
        playAdornmentInput(name),
        {
          inputType: GameInputType.SELECT_RESOURCES,
          toSpend: false,
          prevInputType: GameInputType.PLAY_ADORNMENT,
          adornmentContext: name,
          maxResources: 2,
          minResources: 2,
          clientOptions: {
            resources: {
              [ResourceType.BERRY]: 2,
            },
          },
        },
      ]);
      expect(player.getNumResourcesByType(ResourceType.PEARL)).to.be(0);
      expect(player.getNumResourcesByType(ResourceType.BERRY)).to.be(2);
    });
  });
});
