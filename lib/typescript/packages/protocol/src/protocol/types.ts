/**
 * Pathland Protocol Types
 */

export type PropertyValue =
  | { type: 'u8'; value: number }
  | { type: 'u32'; value: number }
  | { type: 'i32'; value: number }
  | { type: 'f32'; value: number }
  | { type: 'string'; value: string }
  | { type: 'enum'; value: number }
  | { type: 'color'; kind: 'semantic'; tokenId: number }
  | { type: 'color'; kind: 'literal'; rgba: number }
  | { type: 'designToken'; path: string };

export type CreateNodeCommand = {
  opcode: 'CREATE_NODE';
  nodeId: number;
  componentType: number;
  properties: Map<number, PropertyValue>;
};

export type DeleteNodeCommand = {
  opcode: 'DELETE_NODE';
  nodeId: number;
};

export type InsertChildCommand = {
  opcode: 'INSERT_CHILD';
  parentId: number;
  childId: number;
  index: number;
};

export type RemoveChildCommand = {
  opcode: 'REMOVE_CHILD';
  parentId: number;
  childId: number;
};

export type MoveChildCommand = {
  opcode: 'MOVE_CHILD';
  parentId: number;
  childId: number;
  index: number;
};

export type ResetCommand = {
  opcode: 'RESET';
};

export type SetPropertyCommand = {
  opcode: 'SET_PROPERTY';
  nodeId: number;
  propertyId: number;
  value: PropertyValue;
};

export type SetDesignTokenCommand = {
  opcode: 'SET_DESIGN_TOKEN';
  tokenPath: string;
  value: PropertyValue;
};

/**
 * Event/gesture payload data, matching the binary protocol's event and
 * gesture payload layouts (coordinates as numbers, booleans as 0/1).
 */
export type EventData = Record<string, number | boolean>;

export type RegisterEventHandlerCommand = {
  opcode: 'REGISTER_EVENT_HANDLER';
  nodeId: number;
  eventType: number;
  handlerId: number;
};

export type DispatchEventCommand = {
  opcode: 'DISPATCH_EVENT';
  targetId: number;
  eventType: number;
  timestamp?: number;
  /** 0=capture, 1=target, 2=bubble */
  phase?: number;
  data?: EventData;
};

export type AttachGestureCommand = {
  opcode: 'ATTACH_GESTURE';
  nodeId: number;
  gestureType: number;
  gestureRecognizerId: number;
  handlerPhase?: number;
  onBeganHandler?: number;
  onChangedHandler?: number;
  onEndedHandler?: number;
  onCancelledHandler?: number;
};

export type GestureUpdateCommand = {
  opcode: 'GESTURE_UPDATE';
  targetId: number;
  gestureType: number;
  gestureState: number;
  timestamp?: number;
  gestureId: number;
  data?: EventData;
};

export type SetEnvironmentCommand = {
  opcode: 'SET_ENVIRONMENT';
  fields: Map<number, PropertyValue>;
  /** Echo of the REQUEST_ENVIRONMENT requestId, or 0 for a proactive message. */
  requestId?: number;
};

export type UpdateEnvironmentCommand = {
  opcode: 'UPDATE_ENVIRONMENT';
  fields: Map<number, PropertyValue>;
  /** Echo of the REQUEST_ENVIRONMENT requestId, or 0 for a proactive message. */
  requestId?: number;
};

export type RequestEnvironmentCommand = {
  opcode: 'REQUEST_ENVIRONMENT';
  requestId: number;
  fieldIds: number[];
};

export type Command =
  | CreateNodeCommand
  | DeleteNodeCommand
  | InsertChildCommand
  | RemoveChildCommand
  | MoveChildCommand
  | ResetCommand
  | SetPropertyCommand
  | SetDesignTokenCommand
  | RegisterEventHandlerCommand
  | DispatchEventCommand
  | AttachGestureCommand
  | GestureUpdateCommand
  | SetEnvironmentCommand
  | UpdateEnvironmentCommand
  | RequestEnvironmentCommand;

export type DecodedMessage = {
  version: number;
  commands: Command[];
};
