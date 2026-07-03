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
  data?: unknown;
};

export type SetEnvironmentCommand = {
  opcode: 'SET_ENVIRONMENT';
  fields: Map<number, PropertyValue>;
};

export type UpdateEnvironmentCommand = {
  opcode: 'UPDATE_ENVIRONMENT';
  fields: Map<number, PropertyValue>;
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
  | SetPropertyCommand
  | SetDesignTokenCommand
  | RegisterEventHandlerCommand
  | DispatchEventCommand
  | SetEnvironmentCommand
  | UpdateEnvironmentCommand
  | RequestEnvironmentCommand;

export type DecodedMessage = {
  version: number;
  commands: Command[];
};
