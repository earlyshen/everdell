// All known cards
export enum CardName {
  ARCHITECT = "ARCHITECT",
  BARD = "BARD",
  BARGE_TOAD = "BARGE_TOAD",
  CASTLE = "CASTLE",
  CEMETARY = "CEMETARY",
  CHAPEL = "CHAPEL",
  CHIP_SWEEP = "CHIP_SWEEP",
  CLOCK_TOWER = "CLOCK_TOWER",
  COURTHOUSE = "COURTHOUSE",
  CRANE = "CRANE",
  DOCTOR = "DOCTOR",
  DUNGEON = "DUNGEON",
  EVERTREE = "EVERTREE",
  FAIRGROUNDS = "FAIRGROUNDS",
  FARM = "FARM",
  FOOL = "FOOL",
  GENERAL_STORE = "GENERAL_STORE",
  HISTORIAN = "HISTORIAN",
  HUSBAND = "HUSBAND",
  INN = "INN",
  INNKEEPER = "INNKEEPER",
  JUDGE = "JUDGE",
  KING = "KING",
  LOOKOUT = "LOOKOUT",
  MINE = "MINE",
  MINER_MOLE = "MINER_MOLE",
  MONASTERY = "MONASTERY",
  MONK = "MONK",
  PALACE = "PALACE",
  PEDDLER = "PEDDLER",
  POST_OFFICE = "POST_OFFICE",
  POSTAL_PIGEON = "POSTAL_PIGEON",
  QUEEN = "QUEEN",
  RANGER = "RANGER",
  RESIN_REFINERY = "RESIN_REFINERY",
  RUINS = "RUINS",
  SCHOOL = "SCHOOL",
  SHEPHERD = "SHEPHERD",
  SHOPKEEPER = "SHOPKEEPER",
  STOREHOUSE = "STOREHOUSE",
  TEACHER = "TEACHER",
  THEATRE = "THEATRE",
  TWIG_BARGE = "TWIG_BARGE",
  UNDERTAKER = "UNDERTAKER",
  UNIVERSITY = "UNIVERSITY",
  WANDERER = "WANDERER",
  WIFE = "WIFE",
  WOODCARVER = "WOODCARVER",
}

export enum ResourceType {
  TWIG = "TWIG",
  RESIN = "RESIN",
  BERRY = "BERRY",
  PEBBLE = "PEBBLE",
  VP = "VP",
}

export type ResourceMap = Partial<Record<ResourceType, number>>;

export type CardCost = {
  [ResourceType.TWIG]?: number;
  [ResourceType.BERRY]?: number;
  [ResourceType.PEBBLE]?: number;
  [ResourceType.RESIN]?: number;
};

export enum GameInputType {
  PLAY_CARD = "PLAY_CARD",
  PLACE_WORKER = "PLACE_WORKER",
  VISIT_DESTINATION_CARD = "VISIT_DESTINATION_CARD",
  CLAIM_EVENT = "CLAIM_EVENT",
  PREPARE_FOR_SEASON = "PREPARE_FOR_SEASON",

  REPLENISH_MEADOW = "REPLENISH_MEADOW",
  DRAW_CARDS = "DRAW_CARDS",
}

export type GameInput =
  | {
      inputType: GameInputType.DRAW_CARDS;
      playerId: string;
      count: number;
    }
  | {
      inputType: GameInputType.REPLENISH_MEADOW;
    }
  | {
      inputType: GameInputType.PLACE_WORKER;
      location: LocationName;
      clientOptions?: {
        cardsToDiscard?: CardName[];
        resourcesToGain?: {
          [ResourceType.TWIG]?: number;
          [ResourceType.BERRY]?: number;
          [ResourceType.PEBBLE]?: number;
          [ResourceType.RESIN]?: number;
        };
      };
    }
  | {
      inputType: GameInputType.VISIT_DESTINATION_CARD;
      card: CardName;
      playerId: string;
      clientOptions?: {
        // lookout
        location?: LocationName;

        // monastery
        targetPlayerId?: string;

        // monastery
        resourcesToSpend?: {
          [ResourceType.TWIG]?: number;
          [ResourceType.BERRY]?: number;
          [ResourceType.PEBBLE]?: number;
          [ResourceType.RESIN]?: number;
        };
      };
    }
  | {
      inputType: GameInputType.PLAY_CARD;
      card: CardName;
      fromMeadow: boolean;
      clientOptions?: {
        // fool, miner mole
        targetPlayerId?: string;

        // bard, post office
        cardsToDiscard?: CardName[];

        // chip sweep, miner mole, ruins
        targetCard?: CardName;

        // husband, peddler
        resourcesToGain?: {
          [ResourceType.VP]?: number;
          [ResourceType.TWIG]?: number;
          [ResourceType.BERRY]?: number;
          [ResourceType.PEBBLE]?: number;
          [ResourceType.RESIN]?: number;
        };

        // wood carver, docter, peddler
        resourcesToSpend?: {
          [ResourceType.VP]?: number;
          [ResourceType.TWIG]?: number;
          [ResourceType.BERRY]?: number;
          [ResourceType.PEBBLE]?: number;
          [ResourceType.RESIN]?: number;
        };
      };
    }
  | {
      inputType: GameInputType.CLAIM_EVENT;
      event: EventName;
    }
  | {
      inputType: GameInputType.PREPARE_FOR_SEASON;
    };

export enum Season {
  WINTER = "WINTER",
  SPRING = "SPRING",
  SUMMER = "SUMMER",
  AUTUMN = "AUTUMN",
}

export enum CardType {
  TRAVELER = "TRAVELER", // Tan
  PRODUCTION = "PRODUCTION", // Green
  DESTINATION = "DESTINATION", // Red
  GOVERNANCE = "GOVERNANCE", // Blue
  PROSPERITY = "PROSPERITY", // Purple
}

export enum LocationOccupancy {
  EXCLUSIVE = "EXCLUSIVE",
  EXCLUSIVE_FOUR = "EXCLUSIVE_FOUR",
  UNLIMITED = "UNLIMITED",
}

export enum LocationType {
  BASIC = "BASIC",
  FOREST = "FOREST",
  HAVEN = "HAVEN",
  JOURNEY = "JOURNEY",
}

export enum EventType {
  BASIC = "BASIC",
  SPECIAL = "SPECIAL",
}

export enum LocationName {
  HAVEN = "HAVEN",
  JOURNEY_FIVE = "JOURNEY_FIVE",
  JOURNEY_FOUR = "JOURNEY_FOUR",
  JOURNEY_THREE = "JOURNEY_THREE",
  JOURNEY_TWO = "JOURNEY_TWO",
  BASIC_ONE_BERRY = "BASIC_ONE_BERRY",
  BASIC_ONE_BERRY_AND_ONE_CARD = "BASIC_ONE_BERRY_AND_ONE_CARD",
  BASIC_ONE_RESIN_AND_ONE_CARD = "BASIC_ONE_RESIN_AND_ONE_CARD",
  BASIC_ONE_STONE = "BASIC_ONE_STONE",
  BASIC_THREE_TWIGS = "BASIC_THREE_TWIGS",
  BASIC_TWO_CARDS_AND_ONE_VP = "BASIC_TWO_CARDS_AND_ONE_VP",
  BASIC_TWO_RESIN = "BASIC_TWO_RESIN",
  BASIC_TWO_TWIGS_AND_ONE_CARD = "BASIC_TWO_TWIGS_AND_ONE_CARD",
}

export enum EventName {
  BASIC_FOUR_PRODUCTION_TAGS = "BASIC_FOUR_PRODUCTION_TAGS",
  BASIC_THREE_DESTINATION = "BASIC_THREE_DESTINATION",
  BASIC_THREE_GOVERNANCE = "BASIC_THREE_GOVERNANCE",
  BASIC_THREE_TRAVELER = "BASIC_THREE_TRAVELER",
}

export type LocationNameToPlayerIds = Partial<
  { [key in LocationName]: string[] }
>;

export type EventNameToPlayerId = Partial<
  { [key in EventName]: string | null }
>;

export type PlayedCardInfo = {
  // constructions
  isOccupied?: boolean;

  // clocktower, storehouse etc
  resources?: {
    [ResourceType.VP]?: number;
    [ResourceType.TWIG]?: number;
    [ResourceType.BERRY]?: number;
    [ResourceType.PEBBLE]?: number;
    [ResourceType.RESIN]?: number;
  };

  // queen, inn etc
  workers?: string[];
  maxWorkers?: number;

  // dungeon
  pairedCards?: string[];
};
