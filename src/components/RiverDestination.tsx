import * as React from "react";

import styles from "../styles/RiverDestination.module.css";

import {
  RiverDestination as RiverDestinationModel,
  RiverDestinationMap,
} from "../model/riverDestination";
import {
  ResourceType,
  RiverDestinationName,
  RiverDestinationSpot as TRiverDestinationSpot,
} from "../model/types";

import { Description, ItemWrapper } from "./common";

const RiverDestinationInner = ({ name }: { name: RiverDestinationName }) => {
  const riverDestination = RiverDestinationModel.fromName(name);
  return (
    <div className={styles.item}>
      <div className={styles.header}>
        {riverDestination.name}
        {riverDestination.name !== RiverDestinationName.SHOAL && (
          <div className={styles.location_type}>{riverDestination.type}</div>
        )}
      </div>
      <div className={styles.description}>
        <Description textParts={riverDestination.description} />
      </div>
    </div>
  );
};

const RiverDestinationHidden = () => {
  return (
    <div className={styles.hidden_item}>
      <div></div>
      <Description
        textParts={[
          { type: "text", text: "Visit to gain 1 " },
          { type: "resource", resourceType: ResourceType.PEARL },
          { type: "text", text: " and reveal hidden " },
          { type: "em", text: "River Destination" },
          { type: "text", text: "." },
        ]}
      />
      <div></div>
    </div>
  );
};

const RiverDestination = ({ name }: { name: RiverDestinationName }) => {
  return (
    <ItemWrapper>
      <RiverDestinationInner name={name} />
    </ItemWrapper>
  );
};

export const RiverDestinationSpot = ({
  name,
  destination = null,
}: {
  name: TRiverDestinationSpot;
  destination?: RiverDestinationName | null;
}) => {
  destination =
    name == TRiverDestinationSpot.SHOAL
      ? RiverDestinationName.SHOAL
      : destination;
  return (
    <ItemWrapper
      footerChildren={
        <div className={styles.spot_name}>
          <Description textParts={RiverDestinationMap.getSpotGameText(name)} />
        </div>
      }
    >
      <div className={styles.spot}>
        {destination ? (
          <RiverDestinationInner name={destination} />
        ) : (
          <RiverDestinationHidden />
        )}
      </div>
    </ItemWrapper>
  );
};

export default RiverDestination;
