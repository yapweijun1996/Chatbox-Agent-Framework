var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/core/types.ts
var ErrorType = /* @__PURE__ */ ((ErrorType2) => {
  ErrorType2["NETWORK"] = "network";
  ErrorType2["TIMEOUT"] = "timeout";
  ErrorType2["PERMISSION"] = "permission";
  ErrorType2["VALIDATION"] = "validation";
  ErrorType2["EXECUTION"] = "execution";
  ErrorType2["EMPTY_RESULT"] = "empty_result";
  ErrorType2["UNTRUSTED_RESULT"] = "untrusted_result";
  ErrorType2["BUDGET_EXCEEDED"] = "budget_exceeded";
  ErrorType2["UNKNOWN"] = "unknown";
  return ErrorType2;
})(ErrorType || {});

// src/core/state.ts
function createState(goal, policy) {
  const now = Date.now();
  return {
    id: generateId(),
    conversation: {
      messages: [],
      toolResultsSummary: []
    },
    task: {
      goal,
      steps: [],
      currentNode: "",
      currentStepIndex: 0,
      progress: 0
    },
    memory: {
      shortTerm: {},
      longTermKeys: []
    },
    artifacts: {},
    telemetry: {
      totalDuration: 0,
      tokenCount: 0,
      toolCallCount: 0,
      errorCount: 0,
      retryCount: 0,
      nodeTimings: {}
    },
    policy: {
      maxToolCalls: 20,
      maxDuration: 3e5,
      // 5 分钟
      maxRetries: 3,
      permissions: {},
      useStreaming: true,
      // 默认启用流式
      ...policy
    },
    createdAt: now,
    updatedAt: now
  };
}
function updateState(state, updater) {
  const draft = deepClone(state);
  const result = updater(draft);
  const newState = result || draft;
  newState.updatedAt = Date.now();
  return newState;
}
function serializeState(state) {
  return JSON.stringify(state);
}
function deserializeState(json) {
  return JSON.parse(json);
}
function validateState(state) {
  return !!(state.id && state.conversation && state.task && state.memory && state.artifacts && state.telemetry && state.policy);
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function deepClone(obj) {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}
var StateHelpers = {
  /** 添加消息 */
  addMessage(state, role, content) {
    return updateState(state, (draft) => {
      draft.conversation.messages.push({
        role,
        content,
        timestamp: Date.now()
      });
    });
  },
  /** 更新任务进度 */
  updateProgress(state, progress) {
    return updateState(state, (draft) => {
      draft.task.progress = Math.min(100, Math.max(0, progress));
    });
  },
  /** 设置当前节点 */
  setCurrentNode(state, nodeId) {
    return updateState(state, (draft) => {
      draft.task.currentNode = nodeId;
    });
  },
  /** 添加工具调用计数 */
  incrementToolCall(state) {
    return updateState(state, (draft) => {
      draft.telemetry.toolCallCount += 1;
    });
  },
  /** 添加错误计数 */
  incrementError(state) {
    return updateState(state, (draft) => {
      draft.telemetry.errorCount += 1;
    });
  },
  /** 添加重试计数 */
  incrementRetry(state) {
    return updateState(state, (draft) => {
      draft.telemetry.retryCount += 1;
    });
  },
  /** 记录节点耗时 */
  recordNodeTiming(state, nodeId, duration) {
    return updateState(state, (draft) => {
      draft.telemetry.nodeTimings[nodeId] = (draft.telemetry.nodeTimings[nodeId] || 0) + duration;
      draft.telemetry.totalDuration += duration;
    });
  },
  /** 记录 Token 使用情况 */
  addTokenUsage(state, usage) {
    return updateState(state, (draft) => {
      if (usage.prompt) draft.telemetry.tokenCount += usage.prompt;
      if (usage.completion) draft.telemetry.tokenCount += usage.completion;
      if (!usage.prompt && !usage.completion && usage.total) {
        draft.telemetry.tokenCount += usage.total;
      }
    });
  },
  /** 检查预算是否超限 */
  checkBudget(state) {
    const { telemetry, policy } = state;
    if (telemetry.toolCallCount >= policy.maxToolCalls) {
      return { exceeded: true, reason: `\u5DE5\u5177\u8C03\u7528\u6B21\u6570\u8D85\u9650 (${telemetry.toolCallCount}/${policy.maxToolCalls})` };
    }
    if (telemetry.totalDuration >= policy.maxDuration) {
      return { exceeded: true, reason: `\u603B\u8017\u65F6\u8D85\u9650 (${telemetry.totalDuration}ms/${policy.maxDuration}ms)` };
    }
    if (telemetry.retryCount >= policy.maxRetries) {
      return { exceeded: true, reason: `\u91CD\u8BD5\u6B21\u6570\u8D85\u9650 (${telemetry.retryCount}/${policy.maxRetries})` };
    }
    return { exceeded: false };
  }
};

// src/core/event-stream.ts
var EventStream = class {
  constructor() {
    __publicField(this, "events", []);
    __publicField(this, "listeners", /* @__PURE__ */ new Map());
    __publicField(this, "payloadStore", /* @__PURE__ */ new Map());
  }
  /**
   * 发射事件
   */
  emit(type, status, summary, options) {
    const event = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type,
      status,
      summary,
      nodeId: options?.nodeId,
      metadata: options?.metadata
    };
    if (options?.payload !== void 0) {
      const payloadRef = `payload-${event.id}`;
      this.payloadStore.set(payloadRef, options.payload);
      event.payloadRef = payloadRef;
    }
    this.events.push(event);
    if (this.events.length > 1e3) {
      this.cleanup();
    }
    this.notifyListeners(type, event);
    this.notifyListeners("*", event);
    return event;
  }
  cleanup() {
    const removalCount = this.events.length - 1e3;
    if (removalCount <= 0) return;
    const removedEvents = this.events.splice(0, removalCount);
    removedEvents.forEach((evt) => {
      if (evt.payloadRef) {
        this.payloadStore.delete(evt.payloadRef);
      }
    });
  }
  /**
   * 订阅事件
   */
  on(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, /* @__PURE__ */ new Set());
    }
    this.listeners.get(type).add(listener);
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }
  /**
   * 获取所有事件
   */
  getEvents() {
    return [...this.events];
  }
  /**
   * 获取 payload
   */
  getPayload(payloadRef) {
    return this.payloadStore.get(payloadRef);
  }
  /**
   * 清空事件流
   */
  clear() {
    this.events = [];
    this.payloadStore.clear();
  }
  /**
   * 导出事件流（用于 debug bundle）
   */
  export() {
    const payloads = {};
    this.payloadStore.forEach((value, key) => {
      payloads[key] = value;
    });
    return {
      events: this.events,
      payloads
    };
  }
  /**
   * 从导出数据恢复
   */
  import(data) {
    this.events = data.events;
    this.payloadStore = new Map(Object.entries(data.payloads));
  }
  notifyListeners(type, event) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${type}:`, error);
        }
      });
    }
  }
  generateEventId() {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// src/core/tool-registry.ts
var ToolRegistry = class {
  constructor() {
    __publicField(this, "tools", /* @__PURE__ */ new Map());
  }
  /**
   * 注册工具
   */
  register(tool) {
    if (this.tools.has(tool.name)) {
      throw new Error(`\u5DE5\u5177 "${tool.name}" \u5DF2\u6CE8\u518C`);
    }
    this.tools.set(tool.name, tool);
  }
  /**
   * 批量注册工具
   */
  registerAll(tools) {
    tools.forEach((tool) => this.register(tool));
  }
  /**
   * 获取工具
   */
  get(name) {
    return this.tools.get(name);
  }
  /**
   * 检查工具是否存在
   */
  has(name) {
    return this.tools.has(name);
  }
  /**
   * 获取所有工具名称
   */
  list() {
    return Array.from(this.tools.keys());
  }
  /**
   * 校验输入
   */
  validateInput(toolName, input) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { valid: false, error: `\u5DE5\u5177 "${toolName}" \u4E0D\u5B58\u5728` };
    }
    try {
      const data = tool.inputSchema.parse(input);
      return { valid: true, data };
    } catch (error) {
      if (error instanceof external_exports.ZodError) {
        return { valid: false, error: `\u8F93\u5165\u6821\u9A8C\u5931\u8D25: ${error.errors.map((e) => e.message).join(", ")}` };
      }
      return { valid: false, error: String(error) };
    }
  }
  /**
   * 校验输出
   */
  validateOutput(toolName, output) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { valid: false, error: `\u5DE5\u5177 "${toolName}" \u4E0D\u5B58\u5728` };
    }
    try {
      const data = tool.outputSchema.parse(output);
      return { valid: true, data };
    } catch (error) {
      if (error instanceof external_exports.ZodError) {
        return { valid: false, error: `\u8F93\u51FA\u6821\u9A8C\u5931\u8D25: ${error.errors.map((e) => e.message).join(", ")}` };
      }
      return { valid: false, error: String(error) };
    }
  }
  /**
   * 检查权限
   */
  checkPermission(toolName, permissions) {
    const tool = this.tools.get(toolName);
    if (!tool) return false;
    if (!tool.permissions || tool.permissions.length === 0) {
      return true;
    }
    return tool.permissions.every((perm) => permissions[perm] === true);
  }
  /**
   * 检查节点是否允许调用工具
   */
  checkNodeAllowed(toolName, nodeId) {
    const tool = this.tools.get(toolName);
    if (!tool) return false;
    if (!tool.allowedNodes || tool.allowedNodes.length === 0) {
      return true;
    }
    return tool.allowedNodes.includes(nodeId);
  }
  /**
   * 执行工具（带超时控制）
   */
  async execute(toolName, input, options) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `\u5DE5\u5177 "${toolName}" \u4E0D\u5B58\u5728` };
    }
    if (options?.nodeId && !this.checkNodeAllowed(toolName, options.nodeId)) {
      return { success: false, error: `\u8282\u70B9 "${options.nodeId}" \u4E0D\u5141\u8BB8\u8C03\u7528\u5DE5\u5177 "${toolName}"` };
    }
    if (options?.permissions && !this.checkPermission(toolName, options.permissions)) {
      return { success: false, error: `\u7F3A\u5C11\u5FC5\u9700\u6743\u9650: ${tool.permissions.join(", ")}` };
    }
    const inputValidation = this.validateInput(toolName, input);
    if (!inputValidation.valid) {
      return { success: false, error: inputValidation.error };
    }
    try {
      const output = await this.executeWithTimeout(
        tool.execute(inputValidation.data, {
          onStream: options?.onStream
        }),
        tool.timeout
      );
      const outputValidation = this.validateOutput(toolName, output);
      if (!outputValidation.valid) {
        return { success: false, error: `\u5951\u7EA6\u9519\u8BEF: ${outputValidation.error}` };
      }
      return { success: true, output: outputValidation.data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  executeWithTimeout(promise, timeoutMs) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`\u5DE5\u5177\u6267\u884C\u8D85\u65F6 (${timeoutMs}ms)`));
      }, timeoutMs);
    });
    return Promise.race([
      promise,
      timeoutPromise
    ]).finally(() => {
      clearTimeout(timeoutHandle);
    });
  }
};

// src/core/error-handler.ts
function createError(type, message, options) {
  return {
    type,
    message,
    nodeId: options?.nodeId,
    toolName: options?.toolName,
    retryable: options?.retryable ?? isRetryable(type),
    originalError: options?.originalError,
    timestamp: Date.now()
  };
}
function isRetryable(type) {
  switch (type) {
    case "network":
    case "timeout":
    case "execution":
      return true;
    case "permission":
    case "validation":
    case "budget_exceeded":
      return false;
    default:
      return false;
  }
}
function getErrorStrategy(error, retryCount, maxRetries) {
  if (error.type === "budget_exceeded") {
    return {
      shouldRetry: false,
      shouldDegrade: false,
      shouldRollback: false,
      shouldTerminate: true,
      suggestion: "\u5DF2\u8FBE\u5230\u9884\u7B97\u9650\u5236\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u6216\u4F18\u5316\u5DE5\u5177\u8C03\u7528"
    };
  }
  if (error.type === "permission") {
    return {
      shouldRetry: false,
      shouldDegrade: false,
      shouldRollback: false,
      shouldTerminate: true,
      suggestion: "\u6743\u9650\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u5DE5\u5177\u6743\u9650\u914D\u7F6E"
    };
  }
  if (error.type === "validation") {
    return {
      shouldRetry: false,
      shouldDegrade: true,
      shouldRollback: false,
      shouldTerminate: !error.retryable,
      suggestion: "\u8F93\u5165\u6216\u8F93\u51FA\u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5DE5\u5177\u5951\u7EA6"
    };
  }
  if (error.retryable && retryCount < maxRetries) {
    return {
      shouldRetry: true,
      shouldDegrade: false,
      shouldRollback: false,
      shouldTerminate: false,
      suggestion: `\u5C06\u5728 ${getBackoffDelay(retryCount)}ms \u540E\u91CD\u8BD5 (${retryCount + 1}/${maxRetries})`
    };
  }
  if (retryCount >= maxRetries) {
    return {
      shouldRetry: false,
      shouldDegrade: true,
      shouldRollback: false,
      shouldTerminate: false,
      suggestion: "\u91CD\u8BD5\u6B21\u6570\u5DF2\u8017\u5C3D\uFF0C\u5C1D\u8BD5\u964D\u7EA7\u7B56\u7565"
    };
  }
  return {
    shouldRetry: false,
    shouldDegrade: false,
    shouldRollback: false,
    shouldTerminate: true,
    suggestion: "\u65E0\u6CD5\u6062\u590D\u7684\u9519\u8BEF"
  };
}
function getBackoffDelay(retryCount, baseMs = 1e3, multiplier = 2) {
  return baseMs * Math.pow(multiplier, retryCount);
}
async function retryWithBackoff(fn, maxRetries, baseMs = 1e3, multiplier = 2) {
  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries) {
        const delay = getBackoffDelay(i, baseMs, multiplier);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
function rollbackToCheckpoint(checkpoint) {
  return checkpoint.state;
}
function formatErrorMessage(error) {
  const parts = [`[${error.type.toUpperCase()}]`, error.message];
  if (error.nodeId) {
    parts.push(`(\u8282\u70B9: ${error.nodeId})`);
  }
  if (error.toolName) {
    parts.push(`(\u5DE5\u5177: ${error.toolName})`);
  }
  return parts.join(" ");
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/core/node.ts
var BaseNode = class {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
  /**
   * 创建基础 NodeResult
   */
  createResult(state, events = []) {
    return { state, events };
  }
};

// src/core/runner/node-executor.ts
var NodeExecutor = class {
  constructor(deps) {
    this.deps = deps;
  }
  async run(node, state) {
    await this.deps.hooks?.onNodeStart?.(node.id, state);
    this.deps.eventStream.emit("node_start", "info", `\u5F00\u59CB\u6267\u884C\u8282\u70B9: ${node.name}`, {
      nodeId: node.id,
      metadata: {
        nodeName: node.name
      }
    });
    let retryCount = 0;
    let lastError;
    const context = {
      emitEvent: (type, status, summary, payload) => {
        this.deps.eventStream.emit(type, status, summary, {
          nodeId: node.id,
          payload
        });
      }
    };
    while (retryCount <= state.policy.maxRetries) {
      const attemptStartTime = Date.now();
      try {
        const result = await node.execute(state, context);
        const duration = Date.now() - attemptStartTime;
        result.state = StateHelpers.recordNodeTiming(result.state, node.id, duration);
        await this.deps.hooks?.onNodeEnd?.(node.id, result);
        this.deps.eventStream.emit("node_end", "success", `\u5B8C\u6210\u8282\u70B9: ${node.name}`, {
          nodeId: node.id,
          metadata: {
            nodeName: node.name,
            durationMs: duration
          }
        });
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const duration = Date.now() - attemptStartTime;
        const agentError = createError(
          "execution" /* EXECUTION */,
          lastError.message,
          {
            nodeId: node.id,
            retryable: true,
            originalError: lastError
          }
        );
        const strategy = getErrorStrategy(agentError, retryCount, state.policy.maxRetries);
        if (strategy.shouldRetry) {
          retryCount++;
          const delay = getBackoffDelay(retryCount - 1);
          this.deps.eventStream.emit("retry", "warning", strategy.suggestion || "\u91CD\u8BD5\u4E2D...", {
            nodeId: node.id,
            metadata: { retryCount, delay }
          });
          state = StateHelpers.incrementRetry(state);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          state = StateHelpers.incrementError(state);
          this.deps.eventStream.emit("node_end", "failure", `\u8282\u70B9\u6267\u884C\u5931\u8D25: ${node.name}`, {
            nodeId: node.id,
            metadata: {
              nodeName: node.name,
              error: lastError.message,
              attemptedRetries: retryCount,
              durationMs: duration
            }
          });
          throw lastError;
        }
      }
    }
    throw lastError;
  }
};

// src/core/runner/next-node-resolver.ts
function resolveNextNode(graph, currentNodeId, state, explicitNext) {
  if (explicitNext) {
    return explicitNext;
  }
  const edges = graph.edges.filter((e) => e.from === currentNodeId);
  for (const edge of edges) {
    if (edge.condition) {
      if (edge.condition(state)) {
        return edge.to;
      }
    } else {
      return edge.to;
    }
  }
  return null;
}

// src/core/runner/checkpoint-manager.ts
var CheckpointManager = class {
  constructor(persistence, eventStream, hooks) {
    this.persistence = persistence;
    this.eventStream = eventStream;
    this.hooks = hooks;
  }
  async save(state) {
    if (!this.persistence) return;
    const checkpoint = {
      id: `checkpoint-${Date.now()}`,
      stateId: state.id,
      state,
      eventIndex: this.eventStream.getEvents().length,
      timestamp: Date.now()
    };
    await this.persistence.saveCheckpoint(checkpoint);
    this.eventStream.emit("checkpoint", "success", `\u5DF2\u4FDD\u5B58 checkpoint ${checkpoint.id}`, {
      metadata: { checkpointId: checkpoint.id }
    });
    await this.hooks?.onCheckpoint?.(checkpoint);
  }
  async load(checkpointId) {
    if (!this.persistence) {
      throw new Error("\u672A\u914D\u7F6E\u6301\u4E45\u5316\u9002\u914D\u5668\uFF0C\u65E0\u6CD5\u6062\u590D");
    }
    const checkpoint = await this.persistence.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint "${checkpointId}" \u4E0D\u5B58\u5728`);
    }
    return checkpoint;
  }
};

// src/core/runner.ts
var GraphRunner = class {
  constructor(graph, persistence, hooks, options) {
    this.graph = graph;
    this.persistence = persistence;
    this.hooks = hooks;
    __publicField(this, "eventStream");
    __publicField(this, "checkpointInterval");
    // 每 N 个节点保存一次 checkpoint
    __publicField(this, "nodeExecutor");
    __publicField(this, "checkpointManager");
    this.eventStream = new EventStream();
    this.checkpointInterval = options?.checkpointInterval ?? 1;
    this.nodeExecutor = new NodeExecutor({
      eventStream: this.eventStream,
      hooks: this.hooks
    });
    this.checkpointManager = new CheckpointManager(this.persistence, this.eventStream, this.hooks);
  }
  /**
   * 执行流程
   */
  async execute(initialState) {
    let currentState = initialState;
    let currentNodeId = this.graph.entryNode;
    let stepCount = 0;
    const startTime = Date.now();
    try {
      while (currentNodeId && stepCount < this.graph.maxSteps) {
        const budgetCheck = StateHelpers.checkBudget(currentState);
        if (budgetCheck.exceeded) {
          this.eventStream.emit("budget_exceeded", "failure", budgetCheck.reason);
          await this.hooks?.onBudgetWarning?.("budget", 0, 0);
          break;
        }
        const node = this.graph.nodes.find((n) => n.id === currentNodeId);
        if (!node) {
          throw new Error(`\u8282\u70B9 "${currentNodeId}" \u4E0D\u5B58\u5728`);
        }
        currentState = StateHelpers.setCurrentNode(currentState, currentNodeId);
        const result = await this.nodeExecutor.run(node, currentState);
        currentState = result.state;
        result.events.forEach((event) => {
          this.eventStream.emit(
            event.type,
            event.status,
            event.summary,
            {
              nodeId: event.nodeId,
              payload: event.payloadRef ? this.eventStream.getPayload(event.payloadRef) : void 0,
              metadata: event.metadata
            }
          );
        });
        if (stepCount % this.checkpointInterval === 0) {
          await this.checkpointManager.save(currentState);
        }
        const nextNode = resolveNextNode(this.graph, currentNodeId, currentState, result.nextNode);
        if (!nextNode) break;
        currentNodeId = nextNode;
        stepCount++;
      }
      if (stepCount >= this.graph.maxSteps) {
        this.eventStream.emit(
          "budget_exceeded",
          "warning",
          `\u5DF2\u8FBE\u5230\u6700\u5927\u6B65\u6570\u9650\u5236 (${this.graph.maxSteps})`
        );
      }
      const totalDuration = Date.now() - startTime;
      this.eventStream.emit("health_metrics", "info", "Execution health metrics", {
        metadata: {
          totalDurationMs: totalDuration,
          tokenCount: currentState.telemetry.tokenCount,
          toolCallCount: currentState.telemetry.toolCallCount,
          errorCount: currentState.telemetry.errorCount
        }
      });
      return { state: currentState, events: this.eventStream };
    } catch (error) {
      const agentError = createError(
        "execution" /* EXECUTION */,
        String(error),
        { originalError: error instanceof Error ? error : void 0 }
      );
      this.eventStream.emit("error", "failure", agentError.message, {
        payload: agentError
      });
      await this.hooks?.onError?.(agentError);
      throw error;
    }
  }
  /**
   * 从 checkpoint 恢复执行
   */
  async resume(checkpointId) {
    const checkpoint = await this.checkpointManager.load(checkpointId);
    this.eventStream.emit("checkpoint", "info", `\u4ECE checkpoint ${checkpointId} \u6062\u590D`);
    return this.execute(checkpoint.state);
  }
  /**
   * 获取事件流
   */
  getEventStream() {
    return this.eventStream;
  }
  /**
   * 获取图定义（用于调试）
   */
  getGraphDefinition() {
    return this.graph;
  }
};

// src/core/llm-provider.ts
var LLMProvider = class {
  constructor(config) {
    __publicField(this, "config");
    this.config = {
      temperature: 0.7,
      timeout: 6e4,
      ...config
    };
  }
  /**
   * 获取当前模型
   */
  getModel() {
    return this.config.model;
  }
  /**
   * 简便方法：发送单条消息
   */
  async complete(prompt, systemPrompt) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    const response = await this.chat({ messages });
    return response.content;
  }
  /**
   * 辅助方法：构建消息列表
   */
  buildMessages(request) {
    return request.messages;
  }
  /**
   * 辅助方法：合并配置
   */
  mergeConfig(request) {
    return {
      temperature: request.temperature ?? this.config.temperature ?? 0.7
    };
  }
};
var LLMProviderError = class extends Error {
  constructor(message, provider, originalError, statusCode) {
    super(message);
    this.provider = provider;
    this.originalError = originalError;
    this.statusCode = statusCode;
    this.name = "LLMProviderError";
  }
};

// src/providers/openai-provider.ts
var OpenAIProvider = class extends LLMProvider {
  constructor(config) {
    super(config);
    __publicField(this, "apiKey");
    __publicField(this, "baseURL");
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || "https://api.openai.com";
  }
  getProviderName() {
    return "OpenAI";
  }
  async chat(request) {
    const { temperature } = this.mergeConfig(request);
    const requestBody = {
      model: this.config.model,
      messages: request.messages,
      temperature,
      ...request.topP && { top_p: request.topP },
      ...request.stopSequences && { stop: request.stopSequences }
    };
    try {
      const timeoutSignal = AbortSignal.timeout(this.config.timeout || 6e4);
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onAbort);
      timeoutSignal.addEventListener("abort", onAbort);
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      request.signal?.removeEventListener("abort", onAbort);
      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMProviderError(
          `OpenAI API error: ${response.statusText}`,
          "OpenAI",
          void 0,
          response.status
        );
      }
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        finishReason: this.mapFinishReason(data.choices[0].finish_reason),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : void 0,
        model: data.model
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(
        `Failed to call OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        "OpenAI",
        error instanceof Error ? error : void 0
      );
    }
  }
  async *chatStream(request) {
    const { temperature } = this.mergeConfig(request);
    const requestBody = {
      model: this.config.model,
      messages: request.messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
      ...request.topP && { top_p: request.topP },
      ...request.stopSequences && { stop: request.stopSequences }
    };
    try {
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: request.signal
        // Pass through the abort signal for streaming
      });
      if (!response.ok) {
        throw new LLMProviderError(
          `OpenAI API error: ${response.statusText}`,
          "OpenAI",
          void 0,
          response.status
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content;
              const finishReason = parsed.choices[0]?.finish_reason;
              if (delta) {
                yield { delta };
              }
              if (finishReason) {
                yield {
                  delta: "",
                  finishReason: this.mapFinishReason(finishReason)
                };
              }
              if (parsed.usage) {
                yield {
                  delta: "",
                  usage: {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens
                  }
                };
              }
            } catch (e) {
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(
        `Failed to stream from OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        "OpenAI",
        error instanceof Error ? error : void 0
      );
    }
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      case "tool_calls":
        return "tool_calls";
      default:
        return "stop";
    }
  }
};

// src/providers/gemini-provider.ts
var GeminiProvider = class extends LLMProvider {
  constructor(config) {
    super(config);
    __publicField(this, "apiKey");
    this.apiKey = config.apiKey;
  }
  getProviderName() {
    return "Gemini";
  }
  async chat(request) {
    const { temperature } = this.mergeConfig(request);
    const contents = this.convertMessages(request.messages);
    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        ...request.topP && { topP: request.topP },
        ...request.stopSequences && { stopSequences: request.stopSequences }
      }
    };
    try {
      const timeoutSignal = AbortSignal.timeout(this.config.timeout || 6e4);
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onAbort);
      timeoutSignal.addEventListener("abort", onAbort);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );
      request.signal?.removeEventListener("abort", onAbort);
      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMProviderError(
          `Gemini API error: ${response.statusText}`,
          "Gemini",
          void 0,
          response.status
        );
      }
      const data = await response.json();
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new LLMProviderError("Invalid Gemini response format", "Gemini");
      }
      return {
        content: data.candidates[0].content.parts[0].text,
        finishReason: this.mapFinishReason(data.candidates[0].finishReason),
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0
        } : void 0,
        model: this.config.model
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(
        `Failed to call Gemini: ${error instanceof Error ? error.message : String(error)}`,
        "Gemini",
        error instanceof Error ? error : void 0
      );
    }
  }
  async *chatStream(request) {
    const { temperature } = this.mergeConfig(request);
    const contents = this.convertMessages(request.messages);
    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        ...request.topP && { topP: request.topP },
        ...request.stopSequences && { stopSequences: request.stopSequences }
      }
    };
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: request.signal
          // Pass through the abort signal for streaming
        }
      );
      if (!response.ok) {
        throw new LLMProviderError(
          `Gemini API error: ${response.statusText}`,
          "Gemini",
          void 0,
          response.status
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              const finishReason = parsed.candidates?.[0]?.finishReason;
              if (text) {
                yield { delta: text };
              }
              if (finishReason) {
                yield {
                  delta: "",
                  finishReason: this.mapFinishReason(finishReason)
                };
              }
            } catch (e) {
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(
        `Failed to stream from Gemini: ${error instanceof Error ? error.message : String(error)}`,
        "Gemini",
        error instanceof Error ? error : void 0
      );
    }
  }
  /**
   * 转换标准消息格式为 Gemini 格式
   */
  convertMessages(messages) {
    const contents = [];
    for (const msg of messages) {
      if (msg.role === "system") {
        contents.push({
          role: "user",
          parts: [{ text: `System: ${msg.content}` }]
        });
        contents.push({
          role: "model",
          parts: [{ text: "Understood. I will follow these instructions." }]
        });
      } else if (msg.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === "assistant") {
        contents.push({
          role: "model",
          parts: [{ text: msg.content }]
        });
      }
    }
    return contents;
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
        return "content_filter";
      default:
        return "stop";
    }
  }
};

// src/providers/lm-studio-provider.ts
var LMStudioProvider = class extends LLMProvider {
  constructor(config) {
    super(config);
    __publicField(this, "baseURL");
    this.baseURL = config.baseURL;
  }
  getProviderName() {
    return "LM Studio";
  }
  async chat(request) {
    const { temperature } = this.mergeConfig(request);
    const requestBody = {
      model: this.config.model,
      messages: request.messages,
      temperature,
      ...request.topP && { top_p: request.topP },
      ...request.stopSequences && { stop: request.stopSequences }
    };
    try {
      const timeoutSignal = AbortSignal.timeout(this.config.timeout || 6e4);
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onAbort);
      timeoutSignal.addEventListener("abort", onAbort);
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      request.signal?.removeEventListener("abort", onAbort);
      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMProviderError(
          `LM Studio API error: ${response.statusText}`,
          "LM Studio",
          void 0,
          response.status
        );
      }
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        finishReason: this.mapFinishReason(data.choices[0].finish_reason),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : void 0,
        model: data.model
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(
        `Failed to call LM Studio: ${error instanceof Error ? error.message : String(error)}`,
        "LM Studio",
        error instanceof Error ? error : void 0
      );
    }
  }
  async *chatStream(request) {
    const { temperature } = this.mergeConfig(request);
    const requestBody = {
      model: this.config.model,
      messages: request.messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
      ...request.topP && { top_p: request.topP },
      ...request.stopSequences && { stop: request.stopSequences }
    };
    try {
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: request.signal
        // Pass through the abort signal for streaming
      });
      if (!response.ok) {
        throw new LLMProviderError(
          `LM Studio API error: ${response.statusText}`,
          "LM Studio",
          void 0,
          response.status
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      let reasoningOpen = false;
      while (true) {
        if (request.signal?.aborted) {
          await reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const contentDelta = parsed.choices[0]?.delta?.content;
              const reasoningDelta = parsed.choices[0]?.delta?.reasoning_content;
              const finishReason = parsed.choices[0]?.finish_reason;
              if (reasoningDelta) {
                const prefix = reasoningOpen ? "" : "<think>";
                reasoningOpen = true;
                yield { delta: `${prefix}${reasoningDelta}` };
              }
              if (contentDelta) {
                const prefix = reasoningOpen ? "</think>" : "";
                reasoningOpen = false;
                yield { delta: `${prefix}${contentDelta}` };
              }
              if (finishReason) {
                if (reasoningOpen) {
                  reasoningOpen = false;
                  yield { delta: "</think>" };
                }
                yield {
                  delta: "",
                  finishReason: this.mapFinishReason(finishReason)
                };
              }
              if (parsed.usage) {
                yield {
                  delta: "",
                  usage: {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens
                  }
                };
              }
            } catch (e) {
            }
          }
        }
      }
      if (reasoningOpen) {
        yield { delta: "</think>" };
      }
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(
        `Failed to stream from LM Studio: ${error instanceof Error ? error.message : String(error)}`,
        "LM Studio",
        error instanceof Error ? error : void 0
      );
    }
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }
};

// src/providers/provider-factory.ts
function createLLMProvider(config) {
  switch (config.type) {
    case "openai":
      return new OpenAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseURL: config.baseURL,
        temperature: config.temperature,
        timeout: config.timeout
      });
    case "gemini":
      return new GeminiProvider({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        timeout: config.timeout
      });
    case "lm-studio":
      return new LMStudioProvider({
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        timeout: config.timeout
      });
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
function createProviderFromSettings(settings) {
  switch (settings.provider) {
    case "openai":
      return createLLMProvider({
        type: "openai",
        apiKey: settings.openai.apiKey,
        model: settings.openai.model,
        baseURL: settings.openai.baseURL
      });
    case "gemini":
      return createLLMProvider({
        type: "gemini",
        apiKey: settings.gemini.apiKey,
        model: settings.gemini.model
      });
    case "lm-studio":
      return createLLMProvider({
        type: "lm-studio",
        baseURL: settings.lmStudio.baseURL,
        model: settings.lmStudio.model
      });
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}

// src/nodes/llm-planner.ts
var LLMPlannerNode = class extends BaseNode {
  constructor(toolRegistry, config) {
    super("planner", "LLM Planner");
    this.toolRegistry = toolRegistry;
    __publicField(this, "provider");
    this.provider = config?.provider;
  }
  /**
   * 设置 LLM Provider（支持动态更新）
   */
  setProvider(provider) {
    this.provider = provider;
  }
  async execute(state, context) {
    const events = [];
    try {
      const { content, usage } = await this.generatePlanWithLLM(state, state.task.goal, context);
      const steps = this.parseSteps(content);
      let newState = updateState(state, (draft) => {
        draft.task.plan = content;
        draft.task.steps = steps;
        draft.task.progress = 10;
      });
      if (usage) {
        newState = StateHelpers.addTokenUsage(newState, {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
          total: usage.totalTokens
        });
      }
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "node_end",
        nodeId: this.id,
        status: "success",
        summary: `LLM \u751F\u6210\u4E86 ${steps.length} \u4E2A\u5B50\u4EFB\u52A1 (Tokens: ${usage?.totalTokens || "unknown"})`,
        metadata: {
          stepCount: steps.length,
          usage
        }
      });
      return this.createResult(newState, events);
    } catch (error) {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "failure",
        summary: `\u89C4\u5212\u5931\u8D25: ${error}`
      });
      throw error;
    }
  }
  /**
   * 使用 LLM 生成计划
   */
  async generatePlanWithLLM(state, goal, context) {
    const systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u4EFB\u52A1\u89C4\u5212\u52A9\u624B\u3002\u7528\u6237\u4F1A\u7ED9\u4F60\u4E00\u4E2A\u76EE\u6807\uFF0C\u4F60\u9700\u8981\u5C06\u5176\u62C6\u89E3\u4E3A\u6E05\u6670\u7684\u6B65\u9AA4\u3002

\u8981\u6C42\uFF1A
1. \u6BCF\u4E2A\u6B65\u9AA4\u4E00\u884C\uFF0C\u683C\u5F0F\u4E3A "1. \u6B65\u9AA4\u63CF\u8FF0"
2. \u6B65\u9AA4\u8981\u5177\u4F53\u3001\u53EF\u6267\u884C
3. \u6B65\u9AA4\u6570\u91CF\u63A7\u5236\u5728 3-6 \u4E2A
4. \u53EA\u8F93\u51FA\u6B65\u9AA4\u5217\u8868\uFF0C\u4E0D\u8981\u5176\u4ED6\u5185\u5BB9

\u793A\u4F8B\uFF1A
\u7528\u6237\u76EE\u6807\uFF1A\u4F18\u5316\u8FD9\u6BB5 SQL \u5E76\u4FDD\u6301\u7ED3\u679C\u4E00\u81F4
\u4F60\u7684\u8F93\u51FA\uFF1A
1. \u5206\u6790\u5F53\u524D SQL \u8BED\u53E5\u7ED3\u6784
2. \u8BC6\u522B\u6027\u80FD\u74F6\u9888\u548C\u4F18\u5316\u70B9
3. \u751F\u6210\u4F18\u5316\u540E\u7684 SQL \u8BED\u53E5
4. \u9A8C\u8BC1\u4F18\u5316\u524D\u540E\u7ED3\u679C\u4E00\u81F4\u6027`;
    const userPrompt = `\u7528\u6237\u76EE\u6807\uFF1A${goal}

\u8BF7\u751F\u6210\u4EFB\u52A1\u6B65\u9AA4\uFF1A`;
    if (this.provider) {
      return this.callWithProvider(systemPrompt, userPrompt, state, context);
    }
    return this.callWithToolRegistry(systemPrompt, userPrompt, state, context);
  }
  /**
   * 使用 Provider 调用 LLM
   */
  async callWithProvider(systemPrompt, userPrompt, state, context) {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    const useStreaming = state.policy.useStreaming !== false;
    if (useStreaming && context?.emitEvent) {
      let fullContent = "";
      const stream = this.provider.chatStream({
        messages,
        temperature: 0.3
      });
      for await (const chunk of stream) {
        if (chunk.delta) {
          fullContent += chunk.delta;
          context.emitEvent("stream_chunk", "info", "generating plan...", { chunk: chunk.delta });
        }
      }
      console.log("[LLMPlanner] LLM Raw Output:", fullContent);
      return {
        content: fullContent.trim(),
        usage: void 0
        // 流式模式通常不返回 usage
      };
    } else {
      const response = await this.provider.chat({
        messages,
        temperature: 0.3
      });
      console.log("[LLMPlanner] LLM Raw Output:", response.content);
      return {
        content: response.content.trim(),
        usage: response.usage
      };
    }
  }
  /**
   * 使用 ToolRegistry 调用 LLM（回退方案）
   */
  async callWithToolRegistry(systemPrompt, userPrompt, state, context) {
    const useStreaming = state.policy.useStreaming !== false;
    const result = await this.toolRegistry.execute("lm-studio-llm", {
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.3,
      onStream: useStreaming ? (chunk) => {
        context?.emitEvent("stream_chunk", "info", "generating plan...", { chunk });
      } : void 0
    });
    if (!result.success || !result.output) {
      console.error("[LLMPlanner] \u274C LLM \u8C03\u7528\u5931\u8D25");
      throw new Error("LLM \u8C03\u7528\u5931\u8D25");
    }
    const output = result.output;
    console.log("[LLMPlanner] LLM Raw Output:", output.content);
    return {
      content: output.content.trim(),
      usage: output.usage
    };
  }
  /**
   * 解析步骤
   */
  parseSteps(plan) {
    const lines = plan.split("\n").filter((line) => line.trim());
    return lines.map((line, index) => ({
      id: `step-${index + 1}`,
      description: line.replace(/^\d+\.\s*/, ""),
      // 移除序号
      status: "pending"
    }));
  }
};

// src/core/schema-utils.ts
function extractSchemaProperties(schema) {
  if (!schema || !schema._def) return {};
  try {
    const shape = schema._def.shape?.();
    if (!shape) return {};
    const properties = {};
    for (const [key, value] of Object.entries(shape)) {
      const def = value?._def;
      if (def) {
        properties[key] = {
          type: zodTypeToJsonType(def.typeName),
          description: def.description || key
        };
      }
    }
    return properties;
  } catch {
    return {};
  }
}
function extractRequiredFields(schema) {
  if (!schema || !schema._def) return [];
  try {
    const shape = schema._def.shape?.();
    if (!shape) return [];
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      const def = value?._def;
      if (def && def.typeName !== "ZodOptional") {
        required.push(key);
      }
    }
    return required;
  } catch {
    return [];
  }
}
function zodTypeToJsonType(zodType) {
  const mapping = {
    "ZodString": "string",
    "ZodNumber": "number",
    "ZodBoolean": "boolean",
    "ZodArray": "array",
    "ZodObject": "object"
  };
  return mapping[zodType] || "string";
}
function buildOpenAIToolsList(toolRegistry, excludeTools = ["lm-studio-llm"]) {
  return toolRegistry.list().filter((name) => !excludeTools.includes(name)).map((name) => {
    const tool = toolRegistry.get(name);
    return {
      type: "function",
      function: {
        name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: extractSchemaProperties(tool.inputSchema),
          required: extractRequiredFields(tool.inputSchema)
        }
      }
    };
  });
}

// src/nodes/tool-call-decider.ts
async function decideToolCall(toolRegistry, stepDescription, options = {}) {
  if (options.provider) {
    return decideWithProvider(toolRegistry, stepDescription, options.provider);
  }
  const providerConfig = options.providerConfig;
  if (providerConfig?.baseURL) {
    return decideWithFetch(toolRegistry, stepDescription, providerConfig.baseURL, providerConfig.model || "default-model");
  }
  return decideWithFetch(toolRegistry, stepDescription, "http://127.0.0.1:6354", "zai-org/glm-4.6v-flash");
}
async function decideWithProvider(toolRegistry, stepDescription, provider) {
  const tools = buildOpenAIToolsList(toolRegistry);
  if (tools.length === 0) {
    return { call: null, usage: void 0 };
  }
  const messages = [
    {
      role: "system",
      content: `You are an assistant. Available tools:
${tools.map((t) => `- ${t.function.name}: ${t.function.description}`).join("\n")}

Respond with JSON: {"tool": "name", "input": {}} or {"tool": null}`
    },
    { role: "user", content: `Task: ${stepDescription}` }
  ];
  try {
    const response = await provider.chat({ messages, temperature: 0.1 });
    const parsed = parseToolDecision(response.content);
    if (parsed?.tool && toolRegistry.has(parsed.tool)) {
      return { call: { toolName: parsed.tool, input: parsed.input || {} }, usage: response.usage };
    }
    return { call: null, usage: response.usage };
  } catch (error) {
    console.error("[ToolRunner] Provider error:", error);
    return { call: fallbackDecide(stepDescription), usage: void 0 };
  }
}
async function decideWithFetch(toolRegistry, stepDescription, baseURL, model) {
  const tools = buildOpenAIToolsList(toolRegistry);
  if (tools.length === 0) return { call: null, usage: void 0 };
  try {
    const response = await fetch(`${baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Select appropriate tool if needed." },
          { role: "user", content: `Task: ${stepDescription}` }
        ],
        tools,
        temperature: 0.1
      })
    });
    if (!response.ok) {
      return { call: fallbackDecide(stepDescription), usage: void 0 };
    }
    const data = await response.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    if (toolCalls?.[0]) {
      const { name, arguments: args } = toolCalls[0].function;
      if (toolRegistry.has(name)) {
        return { call: { toolName: name, input: JSON.parse(args) }, usage: data.usage };
      }
    }
    return { call: null, usage: data.usage };
  } catch (error) {
    return { call: fallbackDecide(stepDescription), usage: void 0 };
  }
}
function parseToolDecision(content) {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
  }
  return null;
}
function fallbackDecide(desc) {
  const lower = desc.toLowerCase();
  if (lower.includes("sql") || lower.includes("\u67E5\u8BE2")) {
    return { toolName: "sql-query", input: { query: "SELECT * FROM users LIMIT 10" } };
  }
  if (lower.includes("\u6587\u6863") || lower.includes("\u641C\u7D22")) {
    return { toolName: "document-search", input: { keywords: ["\u4F18\u5316"] } };
  }
  return null;
}

// src/nodes/tool-runner.ts
var ToolRunnerNode = class extends BaseNode {
  constructor(toolRegistry, config) {
    super("tool-runner", "ToolRunner");
    this.toolRegistry = toolRegistry;
    __publicField(this, "provider");
    this.provider = config?.provider;
  }
  /** 设置 LLM Provider（支持动态更新） */
  setProvider(provider) {
    this.provider = provider;
  }
  async execute(state, context) {
    const events = [];
    let currentState = state;
    const currentStep = state.task.steps[state.task.currentStepIndex];
    if (!currentStep) {
      throw new Error("\u6CA1\u6709\u53EF\u6267\u884C\u7684\u6B65\u9AA4");
    }
    currentState = updateState(currentState, (draft) => {
      const step = draft.task.steps[draft.task.currentStepIndex];
      if (step) {
        step.status = "running";
      }
    });
    try {
      const pendingCall = currentState.task.pendingToolCall;
      if (pendingCall) {
        if (pendingCall.stepId !== currentStep.id) {
          currentState = updateState(currentState, (draft) => {
            delete draft.task.pendingToolCall;
          });
        } else if (pendingCall.status === "pending") {
          return this.createResult(currentState, events);
        } else if (pendingCall.status === "approved") {
          return await this.executeToolCall(currentState, currentStep, pendingCall, context, events);
        } else if (pendingCall.status === "denied") {
          currentState = this.handleDeniedToolCall(currentState, pendingCall);
          events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: "tool_result",
            nodeId: this.id,
            status: "warning",
            summary: `\u5DE5\u5177 ${pendingCall.toolName} \u5DF2\u88AB\u62D2\u7EDD`,
            metadata: {
              toolName: pendingCall.toolName,
              stepId: pendingCall.stepId,
              reason: pendingCall.decisionReason,
              success: false
            }
          });
          return this.createResult(currentState, events);
        }
      }
      const { call: toolCall, usage } = await decideToolCall(
        this.toolRegistry,
        currentStep.description,
        { provider: this.provider, providerConfig: state.artifacts.providerConfig }
      );
      if (usage) {
        currentState = StateHelpers.addTokenUsage(currentState, {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
          total: usage.totalTokens
        });
      }
      if (!toolCall) {
        currentState = updateState(currentState, (draft) => {
          draft.task.steps[draft.task.currentStepIndex].status = "completed";
          draft.task.steps[draft.task.currentStepIndex].result = "\u5DF2\u5B8C\u6210";
          delete draft.task.pendingToolCall;
        });
        events.push({
          id: `evt-${Date.now()}`,
          timestamp: Date.now(),
          type: "node_end",
          nodeId: this.id,
          status: "info",
          summary: `\u6B65\u9AA4 "${currentStep.description}" \u65E0\u9700\u5DE5\u5177\u8C03\u7528`
        });
        return this.createResult(currentState, events);
      }
      if (currentState.policy.allowedTools && currentState.policy.allowedTools.length > 0 && !currentState.policy.allowedTools.includes(toolCall.toolName)) {
        currentState = updateState(currentState, (draft) => {
          const step = draft.task.steps[draft.task.currentStepIndex];
          if (step) {
            step.status = "failed";
            step.error = `Tool "${toolCall.toolName}" is not allowed by policy.`;
          }
          delete draft.task.pendingToolCall;
        });
        events.push({
          id: `evt-${Date.now()}`,
          timestamp: Date.now(),
          type: "tool_result",
          nodeId: this.id,
          status: "warning",
          summary: `\u5DE5\u5177 ${toolCall.toolName} \u88AB\u7B56\u7565\u7981\u6B62`,
          metadata: {
            toolName: toolCall.toolName,
            stepId: currentStep.id,
            success: false,
            reason: "policy"
          }
        });
        context?.emitEvent("audit", "warning", "tool_policy_block", {
          toolName: toolCall.toolName,
          stepId: currentStep.id,
          reason: "policy"
        });
        return this.createResult(currentState, events);
      }
      const tool = this.toolRegistry.get(toolCall.toolName);
      if (tool && tool.requiresConfirmation) {
        const pending = this.buildPendingToolCall(toolCall.toolName, toolCall.input, currentStep, tool);
        currentState = updateState(currentState, (draft) => {
          draft.task.pendingToolCall = pending;
        });
        return this.createResult(currentState, events);
      }
      return await this.executeToolCall(currentState, currentStep, toolCall, context, events);
    } catch (error) {
      currentState = StateHelpers.incrementError(currentState);
      currentState = updateState(currentState, (draft) => {
        const step = draft.task.steps[draft.task.currentStepIndex];
        if (step) {
          step.status = "failed";
          step.error = String(error);
        }
        delete draft.task.pendingToolCall;
      });
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "failure",
        summary: `\u5DE5\u5177\u6267\u884C\u5931\u8D25: ${error}`
      });
      throw error;
    }
  }
  buildPendingToolCall(toolName, input, step, tool) {
    return {
      toolName,
      input,
      stepId: step.id,
      stepDescription: step.description,
      permissions: tool.permissions || [],
      confirmationMessage: tool.confirmationMessage,
      requestedAt: Date.now(),
      status: "pending"
    };
  }
  handleDeniedToolCall(state, pendingCall) {
    return updateState(state, (draft) => {
      const step = draft.task.steps[draft.task.currentStepIndex];
      if (step) {
        step.status = "failed";
        step.error = pendingCall.decisionReason || "Tool execution denied";
      }
      delete draft.task.pendingToolCall;
    });
  }
  async executeToolCall(currentState, currentStep, toolCall, context, events) {
    events.push({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      type: "tool_call",
      nodeId: this.id,
      status: "info",
      summary: `\u8C03\u7528\u5DE5\u5177: ${toolCall.toolName}`,
      metadata: {
        toolName: toolCall.toolName,
        stepId: currentStep.id,
        input: toolCall.input
      }
    });
    context?.emitEvent("audit", "info", "tool_call", {
      toolName: toolCall.toolName,
      stepId: currentStep.id
    });
    const useStreaming = currentState.policy.useStreaming !== false;
    const onStream = useStreaming && context?.emitEvent ? (chunk) => {
      const normalized = normalizeToolStreamChunk(chunk);
      context.emitEvent("stream_chunk", "info", `tool stream: ${toolCall.toolName}`, {
        toolName: toolCall.toolName,
        stepId: currentStep.id,
        chunk: normalized.content,
        raw: normalized.raw,
        chunkType: normalized.type
      });
    } : void 0;
    const startTime = Date.now();
    const result = await this.toolRegistry.execute(toolCall.toolName, toolCall.input, {
      nodeId: this.id,
      permissions: currentState.policy.permissions,
      onStream
    });
    const duration = Date.now() - startTime;
    if (!result.success) {
      context?.emitEvent("audit", "failure", "tool_result", {
        toolName: toolCall.toolName,
        stepId: currentStep.id,
        success: false,
        error: result.error
      });
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "tool_result",
        nodeId: this.id,
        status: "failure",
        summary: `\u5DE5\u5177 ${toolCall.toolName} \u6267\u884C\u5931\u8D25`,
        metadata: {
          toolName: toolCall.toolName,
          stepId: currentStep.id,
          success: false,
          error: result.error
        }
      });
      throw createError("execution" /* EXECUTION */, result.error || "\u5DE5\u5177\u6267\u884C\u5931\u8D25", {
        nodeId: this.id,
        toolName: toolCall.toolName
      });
    }
    currentState = StateHelpers.incrementToolCall(currentState);
    currentState = StateHelpers.recordNodeTiming(currentState, this.id, duration);
    currentState = updateState(currentState, (draft) => {
      const step = draft.task.steps[draft.task.currentStepIndex];
      if (step) {
        step.status = "completed";
        step.result = result.output;
      }
      delete draft.task.pendingToolCall;
      if (!draft.artifacts.toolResults) {
        draft.artifacts.toolResults = [];
      }
      draft.artifacts.toolResults.push({
        stepId: currentStep.id,
        toolName: toolCall.toolName,
        output: result.output,
        timestamp: Date.now()
      });
    });
    events.push({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      type: "tool_result",
      nodeId: this.id,
      status: "success",
      summary: `\u5DE5\u5177 ${toolCall.toolName} \u6267\u884C\u6210\u529F (${duration}ms)`,
      metadata: {
        durationMs: duration,
        toolName: toolCall.toolName,
        stepId: currentStep.id,
        success: true
      }
    });
    context?.emitEvent("audit", "success", "tool_result", {
      toolName: toolCall.toolName,
      stepId: currentStep.id,
      success: true,
      durationMs: duration
    });
    return this.createResult(currentState, events);
  }
};
function normalizeToolStreamChunk(chunk) {
  if (typeof chunk === "string") {
    return { content: chunk, type: "text" };
  }
  return {
    content: chunk.content,
    type: chunk.type,
    raw: chunk.data
  };
}

// src/nodes/confirmation.ts
var ConfirmationNode = class extends BaseNode {
  constructor(config) {
    super("confirmation", "Confirmation");
    __publicField(this, "onConfirm");
    __publicField(this, "autoApprove");
    this.onConfirm = config?.onConfirm;
    this.autoApprove = config?.autoApprove ?? true;
  }
  setConfirmationHandler(handler) {
    this.onConfirm = handler;
  }
  async execute(state, context) {
    const events = [];
    const pending = state.task.pendingToolCall;
    if (!pending || pending.status !== "pending") {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "node_end",
        nodeId: this.id,
        status: "info",
        summary: "\u6CA1\u6709\u9700\u8981\u786E\u8BA4\u7684\u5DE5\u5177\u8C03\u7528"
      });
      return this.createResult(state, events);
    }
    const request = {
      toolName: pending.toolName,
      input: pending.input,
      stepId: pending.stepId,
      stepDescription: pending.stepDescription,
      permissions: pending.permissions,
      confirmationMessage: pending.confirmationMessage,
      requestedAt: pending.requestedAt
    };
    context?.emitEvent("confirmation_required", "warning", `\u7B49\u5F85\u5DE5\u5177\u786E\u8BA4: ${pending.toolName}`, request);
    const decision = await this.resolveDecision(request);
    const updatedState = updateState(state, (draft) => {
      if (draft.task.pendingToolCall) {
        draft.task.pendingToolCall.status = decision.approved ? "approved" : "denied";
        draft.task.pendingToolCall.decidedAt = Date.now();
        if (decision.reason) {
          draft.task.pendingToolCall.decisionReason = decision.reason;
        }
      }
    });
    events.push({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      type: "confirmation_result",
      nodeId: this.id,
      status: decision.approved ? "success" : "warning",
      summary: decision.approved ? `\u5DF2\u6279\u51C6\u5DE5\u5177: ${pending.toolName}` : `\u5DF2\u62D2\u7EDD\u5DE5\u5177: ${pending.toolName}`,
      metadata: {
        toolName: pending.toolName,
        approved: decision.approved,
        reason: decision.reason
      }
    });
    events.push({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      type: "node_end",
      nodeId: this.id,
      status: decision.approved ? "success" : "warning",
      summary: decision.approved ? "\u5DE5\u5177\u5DF2\u6279\u51C6" : "\u5DE5\u5177\u5DF2\u62D2\u7EDD"
    });
    return this.createResult(updatedState, events);
  }
  async resolveDecision(request) {
    if (this.onConfirm) {
      const decision = await this.onConfirm(request);
      if (typeof decision === "boolean") {
        return { approved: decision };
      }
      return decision;
    }
    if (this.autoApprove) {
      return { approved: true, reason: "auto-approved" };
    }
    return { approved: false, reason: "no confirmation handler" };
  }
};

// src/nodes/verifier.ts
var VerifierNode = class extends BaseNode {
  constructor() {
    super("verifier", "Verifier");
  }
  async execute(state) {
    const events = [];
    try {
      const currentStep = state.task.steps[state.task.currentStepIndex];
      if (!currentStep) {
        throw new Error("\u6CA1\u6709\u53EF\u9A8C\u8BC1\u7684\u6B65\u9AA4");
      }
      if (currentStep.status === "failed") {
        const nextStepIndex2 = Math.min(state.task.currentStepIndex + 1, state.task.steps.length);
        const totalSteps2 = state.task.steps.length || 1;
        const progress2 = nextStepIndex2 / totalSteps2 * 80 + 10;
        const newState2 = updateState(state, (draft) => {
          draft.task.currentStepIndex = nextStepIndex2;
          draft.task.progress = Math.round(progress2);
        });
        events.push({
          id: `evt-${Date.now()}`,
          timestamp: Date.now(),
          type: "node_end",
          nodeId: this.id,
          status: "warning",
          summary: `\u6B65\u9AA4 "${currentStep.description}" \u5DF2\u5931\u8D25\uFF0C\u8DF3\u8FC7\u5230\u4E0B\u4E00\u6B65`
        });
        return this.createResult(newState2, events);
      }
      const isValid2 = this.verify(currentStep.result);
      if (!isValid2) {
        events.push({
          id: `evt-${Date.now()}`,
          timestamp: Date.now(),
          type: "error",
          nodeId: this.id,
          status: "warning",
          summary: `\u6B65\u9AA4 "${currentStep.description}" \u9A8C\u8BC1\u5931\u8D25`
        });
        return this.createResult(state, events);
      }
      const nextStepIndex = Math.min(state.task.currentStepIndex + 1, state.task.steps.length);
      const totalSteps = state.task.steps.length || 1;
      const progress = nextStepIndex / totalSteps * 80 + 10;
      const newState = updateState(state, (draft) => {
        draft.task.currentStepIndex = nextStepIndex;
        draft.task.progress = Math.round(progress);
      });
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "node_end",
        nodeId: this.id,
        status: "success",
        summary: `\u6B65\u9AA4\u9A8C\u8BC1\u901A\u8FC7 (\u8FDB\u5EA6: ${Math.round(progress)}%)`
      });
      return this.createResult(newState, events);
    } catch (error) {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "failure",
        summary: `\u9A8C\u8BC1\u5931\u8D25: ${error}`
      });
      throw error;
    }
  }
  /**
   * 验证结果（简化版）
   */
  verify(result) {
    if (result === null || result === void 0) {
      return false;
    }
    if (Array.isArray(result) && result.length === 0) {
      return false;
    }
    if (typeof result === "object" && Object.keys(result).length === 0) {
      return false;
    }
    return true;
  }
};

// src/nodes/responder.ts
var ResponderNode = class extends BaseNode {
  constructor() {
    super("responder", "Responder");
  }
  async execute(state) {
    const events = [];
    try {
      const summary = this.summarizeResults(state);
      const response = this.generateResponse(state, summary);
      let newState = StateHelpers.addMessage(state, "assistant", response);
      newState = StateHelpers.updateProgress(newState, 100);
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "node_end",
        nodeId: this.id,
        status: "success",
        summary: "\u5DF2\u751F\u6210\u6700\u7EC8\u7B54\u590D",
        metadata: { responseLength: response.length }
      });
      return this.createResult(newState, events);
    } catch (error) {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "failure",
        summary: `\u751F\u6210\u7B54\u590D\u5931\u8D25: ${error}`
      });
      throw error;
    }
  }
  /**
   * 汇总结果
   */
  summarizeResults(state) {
    const completedSteps = state.task.steps.filter((s) => s.status === "completed");
    const failedSteps = state.task.steps.filter((s) => s.status === "failed");
    let summary = `## \u4EFB\u52A1\u6267\u884C\u6458\u8981

`;
    summary += `**\u76EE\u6807**: ${state.task.goal}

`;
    summary += `**\u5B8C\u6210\u6B65\u9AA4**: ${completedSteps.length}/${state.task.steps.length}

`;
    if (completedSteps.length > 0) {
      summary += `### \u5DF2\u5B8C\u6210\u6B65\u9AA4
`;
      completedSteps.forEach((step) => {
        summary += `- ${step.description}
`;
      });
      summary += "\n";
    }
    if (failedSteps.length > 0) {
      summary += `### \u5931\u8D25\u6B65\u9AA4
`;
      failedSteps.forEach((step) => {
        summary += `- ${step.description}: ${step.error}
`;
      });
      summary += "\n";
    }
    return summary;
  }
  /**
   * 生成最终答复
   */
  generateResponse(state, summary) {
    let response = summary;
    const toolResults = state.artifacts.toolResults;
    if (toolResults && toolResults.length > 0) {
      response += `### \u5DE5\u5177\u6267\u884C\u7ED3\u679C

`;
      toolResults.forEach((result) => {
        response += `**${result.toolName}**:
`;
        response += `\`\`\`json
${JSON.stringify(result.output, null, 2)}
\`\`\`

`;
      });
    }
    response += `### \u6027\u80FD\u7EDF\u8BA1
`;
    response += `- \u603B\u8017\u65F6: ${state.telemetry.totalDuration}ms
`;
    response += `- \u5DE5\u5177\u8C03\u7528\u6B21\u6570: ${state.telemetry.toolCallCount}
`;
    response += `- \u9519\u8BEF\u6B21\u6570: ${state.telemetry.errorCount}
`;
    response += `- \u91CD\u8BD5\u6B21\u6570: ${state.telemetry.retryCount}
`;
    return response;
  }
};

// src/nodes/llm-responder.ts
var LLMResponderNode = class extends BaseNode {
  constructor(config) {
    super("responder", "LLM Responder");
    __publicField(this, "provider");
    __publicField(this, "includeStats");
    __publicField(this, "language");
    this.provider = config?.provider;
    this.includeStats = config?.includeStats ?? false;
    this.language = config?.language ?? "auto";
  }
  /** 设置 LLM Provider */
  setProvider(provider) {
    this.provider = provider;
  }
  async execute(state, context) {
    const events = [];
    try {
      const executionContext = this.buildExecutionContext(state);
      const response = this.provider ? await this.generateWithLLM(state, executionContext, context) : this.generateTemplateResponse(state, executionContext);
      let newState = StateHelpers.addMessage(state, "assistant", response);
      newState = StateHelpers.updateProgress(newState, 100);
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "node_end",
        nodeId: this.id,
        status: "success",
        summary: "\u5DF2\u751F\u6210\u6700\u7EC8\u7B54\u590D",
        metadata: { responseLength: response.length, usedLLM: !!this.provider }
      });
      return this.createResult(newState, events);
    } catch (error) {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "failure",
        summary: `\u751F\u6210\u7B54\u590D\u5931\u8D25: ${error}`
      });
      throw error;
    }
  }
  /** 构建执行上下文 */
  buildExecutionContext(state) {
    const completedSteps = state.task.steps.filter((s) => s.status === "completed");
    const failedSteps = state.task.steps.filter((s) => s.status === "failed");
    const toolResults = state.artifacts.toolResults;
    return {
      goal: state.task.goal,
      totalSteps: state.task.steps.length,
      completedSteps: completedSteps.map((s) => ({
        description: s.description,
        result: s.result
      })),
      failedSteps: failedSteps.map((s) => ({
        description: s.description,
        error: s.error
      })),
      toolResults: toolResults || [],
      stats: {
        duration: state.telemetry.totalDuration,
        toolCalls: state.telemetry.toolCallCount,
        tokenCount: state.telemetry.tokenCount
      }
    };
  }
  /** 使用 LLM 生成回复 */
  async generateWithLLM(state, ctx, nodeContext) {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(ctx);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    const useStreaming = state.policy.useStreaming !== false;
    if (useStreaming && nodeContext?.emitEvent) {
      let fullContent = "";
      const stream = this.provider.chatStream({
        messages,
        temperature: 0.7
      });
      for await (const chunk of stream) {
        if (chunk.delta) {
          fullContent += chunk.delta;
          nodeContext.emitEvent("stream_chunk", "info", "generating response...", { chunk: chunk.delta });
        }
      }
      return this.appendStats(fullContent.trim(), ctx);
    }
    const response = await this.provider.chat({
      messages,
      temperature: 0.7
    });
    return this.appendStats(response.content.trim(), ctx);
  }
  /** 构建系统提示词 */
  buildSystemPrompt() {
    const langInstruction = this.language === "zh" ? "\u8BF7\u7528\u4E2D\u6587\u56DE\u590D\u3002" : this.language === "en" ? "Please respond in English." : "\u8BF7\u6839\u636E\u7528\u6237\u7684\u539F\u59CB\u95EE\u9898\u8BED\u8A00\u6765\u56DE\u590D\u3002";
    return `\u4F60\u662F\u4E00\u4E2A\u667A\u80FD\u52A9\u624B\uFF0C\u6B63\u5728\u5411\u7528\u6237\u6C47\u62A5\u4EFB\u52A1\u6267\u884C\u7ED3\u679C\u3002

\u8981\u6C42\uFF1A
1. \u7528\u81EA\u7136\u3001\u53CB\u597D\u7684\u8BED\u8A00\u603B\u7ED3\u4EFB\u52A1\u5B8C\u6210\u60C5\u51B5
2. \u7A81\u51FA\u91CD\u8981\u7684\u7ED3\u679C\u548C\u53D1\u73B0
3. \u5982\u679C\u6709\u5931\u8D25\u7684\u6B65\u9AA4\uFF0C\u7B80\u8981\u8BF4\u660E\u539F\u56E0
4. \u56DE\u590D\u8981\u7B80\u6D01\u660E\u4E86\uFF0C\u907F\u514D\u5197\u957F\u7684\u6280\u672F\u7EC6\u8282
5. ${langInstruction}

\u793A\u4F8B\u56DE\u590D\u98CE\u683C\uFF1A
- "\u6211\u5DF2\u7ECF\u5B8C\u6210\u4E86\u60A8\u7684\u8BF7\u6C42\uFF01\u4EE5\u4E0B\u662F\u4E3B\u8981\u53D1\u73B0\uFF1A..."
- "\u4EFB\u52A1\u6267\u884C\u5B8C\u6BD5\u3002\u5173\u4E8E\u60A8\u8BE2\u95EE\u7684\u5185\u5BB9\uFF0C\u6211\u53D1\u73B0..."
- "\u597D\u7684\uFF0C\u6211\u4E3A\u60A8\u67E5\u8BE2\u4E86\u76F8\u5173\u4FE1\u606F\u3002\u7ED3\u679C\u663E\u793A..."`;
  }
  /** 构建用户提示词 */
  buildUserPrompt(ctx) {
    let prompt = `\u7528\u6237\u7684\u539F\u59CB\u76EE\u6807\uFF1A${ctx.goal}

`;
    prompt += `\u6267\u884C\u60C5\u51B5\uFF1A
`;
    prompt += `- \u603B\u6B65\u9AA4\u6570\uFF1A${ctx.totalSteps}
`;
    prompt += `- \u5B8C\u6210\uFF1A${ctx.completedSteps.length}
`;
    prompt += `- \u5931\u8D25\uFF1A${ctx.failedSteps.length}

`;
    if (ctx.completedSteps.length > 0) {
      prompt += `\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\uFF1A
`;
      ctx.completedSteps.forEach((step, i) => {
        prompt += `${i + 1}. ${step.description}
`;
        if (step.result) {
          prompt += `   \u7ED3\u679C: ${JSON.stringify(step.result).substring(0, 200)}
`;
        }
      });
      prompt += "\n";
    }
    if (ctx.toolResults.length > 0) {
      prompt += `\u5DE5\u5177\u6267\u884C\u7ED3\u679C\uFF1A
`;
      ctx.toolResults.forEach((result) => {
        prompt += `- ${result.toolName}: ${JSON.stringify(result.output).substring(0, 300)}
`;
      });
      prompt += "\n";
    }
    if (ctx.failedSteps.length > 0) {
      prompt += `\u5931\u8D25\u7684\u6B65\u9AA4\uFF1A
`;
      ctx.failedSteps.forEach((step) => {
        prompt += `- ${step.description}: ${step.error}
`;
      });
    }
    prompt += `
\u8BF7\u6839\u636E\u4EE5\u4E0A\u6267\u884C\u60C5\u51B5\uFF0C\u7528\u81EA\u7136\u8BED\u8A00\u5411\u7528\u6237\u6C47\u62A5\u7ED3\u679C\u3002`;
    return prompt;
  }
  /** 附加统计信息 */
  appendStats(response, ctx) {
    if (!this.includeStats) return response;
    return response + `

---
*\u6267\u884C\u7EDF\u8BA1: ${ctx.stats.toolCalls} \u6B21\u5DE5\u5177\u8C03\u7528, ${ctx.stats.tokenCount} tokens, ${ctx.stats.duration}ms*`;
  }
  /** 模板回复（回退方案） */
  generateTemplateResponse(state, ctx) {
    const allSuccess = ctx.failedSteps.length === 0;
    let response = allSuccess ? `\u2705 \u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF01

` : `\u26A0\uFE0F \u4EFB\u52A1\u90E8\u5206\u5B8C\u6210\u3002

`;
    response += `**\u76EE\u6807**: ${ctx.goal}

`;
    if (ctx.completedSteps.length > 0) {
      response += `**\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4**:
`;
      ctx.completedSteps.forEach((step, i) => {
        response += `${i + 1}. ${step.description}
`;
      });
      response += "\n";
    }
    if (ctx.toolResults.length > 0) {
      response += `**\u6267\u884C\u7ED3\u679C**:
`;
      ctx.toolResults.forEach((result) => {
        response += `- **${result.toolName}**: `;
        const output = JSON.stringify(result.output);
        response += output.length > 100 ? output.substring(0, 100) + "..." : output;
        response += "\n";
      });
    }
    if (ctx.failedSteps.length > 0) {
      response += `
**\u5931\u8D25\u7684\u6B65\u9AA4**:
`;
      ctx.failedSteps.forEach((step) => {
        response += `- ${step.description}: ${step.error}
`;
      });
    }
    return this.appendStats(response, ctx);
  }
};

// src/core/memory/memory-heuristics.ts
var DEFAULT_PREFERENCE_PATTERNS = [
  /i prefer/i,
  /i like/i,
  /i want/i,
  /i need/i,
  /i always/i,
  /please.*always/i,
  /by default/i,
  /make sure/i
];
var DEFAULT_INTENT_PATTERNS = [
  /^remember\b/i,
  /^remember that\b/i,
  /^save\b/i,
  /^save this\b/i,
  /^store\b/i,
  /^store this\b/i,
  /^add to memory\b/i,
  /^note that\b/i
];
function isPreferenceStatement(content, patterns = DEFAULT_PREFERENCE_PATTERNS) {
  const normalized = content.toLowerCase();
  return patterns.some((pattern) => pattern.test(normalized));
}
function extractIntentMemory(content, patterns = DEFAULT_INTENT_PATTERNS) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  for (const pattern of patterns) {
    if (pattern.test(trimmed)) {
      const stripped = trimmed.replace(pattern, "").trim();
      return stripped || trimmed;
    }
  }
  return null;
}
function normalizeMemoryContent(content) {
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content);
  } catch (error) {
    return String(content);
  }
}

// src/nodes/memory.ts
var MemoryNode = class extends BaseNode {
  constructor(config) {
    super("memory", "Memory Saver");
    __publicField(this, "memory");
    __publicField(this, "config");
    this.memory = config.memoryManager;
    this.config = {
      memoryManager: config.memoryManager,
      saveCompletedTasks: config.saveCompletedTasks ?? true,
      saveUserPreferences: config.saveUserPreferences ?? true,
      saveToolResults: config.saveToolResults ?? false,
      taskImportanceScorer: config.taskImportanceScorer
    };
  }
  async execute(state) {
    const events = [];
    try {
      if (state.policy.memoryEnabled === false) {
        return this.createResult(state, events);
      }
      const isComplete = state.task.steps.every((s) => s.status === "completed" || s.status === "failed");
      const hasCompletedSteps = state.task.steps.some((s) => s.status === "completed");
      if (this.config.saveCompletedTasks && isComplete && hasCompletedSteps) {
        const saved = await this.saveCompletedTask(state);
        if (saved) {
          events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: "memory_save",
            nodeId: this.id,
            status: "success",
            summary: "Saved completed task to memory",
            metadata: { kind: "completed-task", tags: ["completed-task", "execution"] }
          });
        }
        events.push({
          id: `evt-${Date.now()}`,
          timestamp: Date.now(),
          type: "node_end",
          nodeId: this.id,
          status: "success",
          summary: "Saved completed task to memory"
        });
      }
      if (this.config.saveUserPreferences) {
        const saved = await this.saveUserPreferences(state);
        if (saved) {
          events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: "memory_save",
            nodeId: this.id,
            status: "success",
            summary: "Saved user preference to memory",
            metadata: { kind: "user-preference", tags: ["user-preference", "conversation"] }
          });
          events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: "node_end",
            nodeId: this.id,
            status: "success",
            summary: "Saved user preference to memory"
          });
        }
      }
      if (this.config.saveToolResults) {
        const savedCount = await this.saveToolResults(state);
        if (savedCount > 0) {
          events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: "memory_save",
            nodeId: this.id,
            status: "success",
            summary: `Saved ${savedCount} tool results to memory`,
            metadata: { kind: "tool-result", count: savedCount, tags: ["tool-result", "execution"] }
          });
        }
      }
      const artifactCount = await this.saveArtifacts(state);
      if (artifactCount > 0) {
        events.push({
          id: `evt-${Date.now()}`,
          timestamp: Date.now(),
          type: "memory_save",
          nodeId: this.id,
          status: "success",
          summary: `Saved ${artifactCount} artifacts to memory`,
          metadata: { kind: "artifact", count: artifactCount }
        });
      }
      return this.createResult(state, events);
    } catch (error) {
      console.error("[MemoryNode] Failed to save memories:", error);
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "warning",
        summary: `Memory save failed: ${error instanceof Error ? error.message : String(error)}`
      });
      return this.createResult(state, events);
    }
  }
  /**
   * Save completed task to long-term memory
   */
  async saveCompletedTask(state) {
    const importance = this.config.taskImportanceScorer ? this.config.taskImportanceScorer(state) : this.calculateTaskImportance(state);
    const completedSteps = state.task.steps.filter((s) => s.status === "completed");
    const taskSummary = {
      goal: state.task.goal,
      stepsCompleted: completedSteps.length,
      totalSteps: state.task.steps.length,
      steps: completedSteps.map((s) => ({
        description: s.description,
        status: s.status
      })),
      completedAt: Date.now()
    };
    await this.memory.remember(taskSummary, {
      tags: ["completed-task", "execution"],
      importance,
      longTerm: importance >= 0.6
    });
    return true;
  }
  /**
   * Detect and save user preferences from conversation
   */
  async saveUserPreferences(state) {
    const userMessages = state.conversation.messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];
    if (!lastUserMessage) return false;
    const isPreference = isPreferenceStatement(lastUserMessage.content);
    if (isPreference) {
      await this.memory.remember(lastUserMessage.content, {
        tags: ["user-preference", "conversation"],
        importance: 0.85,
        longTerm: true
      });
      return true;
    }
    return false;
  }
  /**
   * Save important tool results
   */
  async saveToolResults(state) {
    let savedCount = 0;
    for (const step of state.task.steps) {
      if (step.status === "completed" && step.result) {
        const resultStr = JSON.stringify(step.result);
        if (resultStr.length > 50) {
          await this.memory.remember(
            {
              description: step.description,
              result: step.result
            },
            {
              tags: ["tool-result", "execution"],
              importance: 0.5
            }
          );
          savedCount += 1;
        }
      }
    }
    return savedCount;
  }
  /**
   * Save important artifacts (SQL queries, code, etc.)
   */
  async saveArtifacts(state) {
    let savedCount = 0;
    if (state.artifacts.sql && state.artifacts.sql.length > 0) {
      await this.memory.remember(
        {
          type: "sql",
          queries: state.artifacts.sql,
          goal: state.task.goal
        },
        {
          tags: ["artifact", "sql", "query"],
          importance: 0.6,
          longTerm: true
        }
      );
      savedCount += 1;
    }
    if (state.artifacts.files && state.artifacts.files.length > 0) {
      await this.memory.remember(
        {
          type: "files",
          files: state.artifacts.files,
          goal: state.task.goal
        },
        {
          tags: ["artifact", "files", "reference"],
          importance: 0.7,
          longTerm: true
        }
      );
      savedCount += 1;
    }
    return savedCount;
  }
  /**
   * Calculate task importance based on execution characteristics
   */
  calculateTaskImportance(state) {
    let importance = 0.5;
    const stepCount = state.task.steps.length;
    importance += Math.min(stepCount * 0.05, 0.2);
    const failedCount = state.task.steps.filter((s) => s.status === "failed").length;
    if (failedCount > 0) {
      importance -= failedCount * 0.1;
    }
    const hasArtifacts = state.artifacts.sql && state.artifacts.sql.length > 0 || state.artifacts.files && state.artifacts.files.length > 0;
    if (hasArtifacts) {
      importance += 0.15;
    }
    if (state.conversation.messages.length > 10) {
      importance += 0.1;
    }
    return Math.min(Math.max(importance, 0.1), 1);
  }
};

// src/core/agent-utils.ts
var GREETINGS = ["hi", "hello", "hey", "\u4F60\u597D", "\u55E8", "thanks", "thank you", "\u8C22\u8C22"];
var SIMPLE_PATTERNS = [
  /^what is your name/,
  /^who are you/,
  /^你是谁/,
  /^how are you/,
  /^你好吗/
];
var TASK_KEYWORDS = [
  "search",
  "find",
  "query",
  "analyze",
  "research",
  "create",
  "generate",
  "build",
  "make",
  "write",
  "\u641C\u7D22",
  "\u67E5\u8BE2",
  "\u5206\u6790",
  "\u7814\u7A76",
  "\u521B\u5EFA",
  "\u751F\u6210",
  "\u7F16\u5199",
  "sql",
  "database",
  "\u6570\u636E\u5E93",
  "optimize",
  "\u4F18\u5316",
  "calculate",
  "\u8BA1\u7B97",
  "summarize",
  "\u603B\u7ED3"
];
function shouldUseAgentMode(message, hasTools) {
  if (!hasTools) {
    return false;
  }
  const lowerMessage = message.toLowerCase().trim();
  if (GREETINGS.some((g) => lowerMessage === g || lowerMessage.startsWith(g + " "))) {
    return false;
  }
  if (SIMPLE_PATTERNS.some((p) => p.test(lowerMessage))) {
    return false;
  }
  if (TASK_KEYWORDS.some((k) => lowerMessage.includes(k))) {
    return true;
  }
  return false;
}
function formatAgentResponse(goal, steps) {
  const completedSteps = steps.filter((s) => s.status === "completed");
  let response = `\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF01

`;
  response += `**\u76EE\u6807**: ${goal}

`;
  if (completedSteps.length > 0) {
    response += `**\u6267\u884C\u6B65\u9AA4**:
`;
    completedSteps.forEach((step, i) => {
      response += `${i + 1}. ${step.description}
`;
    });
  }
  return response;
}

// src/core/abort-controller.ts
var AgentAbortController = class {
  constructor() {
    __publicField(this, "controller");
    __publicField(this, "abortState", { aborted: false });
    __publicField(this, "checkpoints", /* @__PURE__ */ new Map());
    this.controller = new AbortController();
  }
  /**
   * 获取 AbortSignal
   */
  get signal() {
    return this.controller.signal;
  }
  /**
   * 检查是否已中断
   */
  get isAborted() {
    return this.abortState.aborted;
  }
  /**
   * 获取中断状态
   */
  getAbortState() {
    return { ...this.abortState };
  }
  /**
   * 中断执行
   */
  abort(reason) {
    if (this.abortState.aborted) return;
    this.abortState = {
      aborted: true,
      reason: reason || "User initiated abort",
      timestamp: Date.now()
    };
    this.controller.abort(reason);
  }
  /**
   * 重置控制器（用于恢复执行）
   */
  reset() {
    this.controller = new AbortController();
    this.abortState = { aborted: false };
  }
  /**
   * 保存 checkpoint
   */
  saveCheckpoint(checkpoint) {
    this.checkpoints.set(checkpoint.id, checkpoint);
    this.abortState.checkpoint = checkpoint;
  }
  /**
   * 获取 checkpoint
   */
  getCheckpoint(id) {
    return this.checkpoints.get(id);
  }
  /**
   * 获取最新的 checkpoint
   */
  getLatestCheckpoint() {
    return this.abortState.checkpoint;
  }
  /**
   * 获取所有 checkpoints
   */
  listCheckpoints() {
    return Array.from(this.checkpoints.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
  /**
   * 清除所有 checkpoints
   */
  clearCheckpoints() {
    this.checkpoints.clear();
    if (this.abortState.checkpoint) {
      delete this.abortState.checkpoint;
    }
  }
  /**
   * 检查是否应该继续执行
   * @throws 如果已中断则抛出 AbortError
   */
  throwIfAborted() {
    if (this.controller.signal.aborted) {
      const error = new Error(this.abortState.reason || "Operation aborted");
      error.name = "AbortError";
      throw error;
    }
  }
  /**
   * 创建带中断检测的 Promise wrapper
   */
  wrapWithAbort(promise) {
    return new Promise((resolve, reject) => {
      if (this.controller.signal.aborted) {
        const error = new Error(this.abortState.reason || "Operation aborted");
        error.name = "AbortError";
        reject(error);
        return;
      }
      const abortHandler = () => {
        const error = new Error(this.abortState.reason || "Operation aborted");
        error.name = "AbortError";
        reject(error);
      };
      this.controller.signal.addEventListener("abort", abortHandler);
      promise.then(resolve).catch(reject).finally(() => {
        this.controller.signal.removeEventListener("abort", abortHandler);
      });
    });
  }
};
function isAbortError(error) {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("aborted");
  }
  return false;
}
function createAbortController() {
  return new AgentAbortController();
}

// src/core/intent-router.ts
var RuleBasedIntentRouter = class {
  async route(context) {
    const mode = shouldUseAgentMode(context.message, context.hasTools) ? "agent" : "chat";
    return { mode, reason: "rule-based" };
  }
};
var DEFAULT_SYSTEM_PROMPT = 'You are a routing assistant. Decide whether to use chat or agent mode. Return JSON only with fields: {"mode":"chat|agent","allowedTools"?:string[],"enableMemory"?:boolean,"enableChatMemory"?:boolean,"reason"?:string}.';
var LLMIntentRouter = class {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = options;
    __publicField(this, "fallbackRouter");
    this.fallbackRouter = options.fallbackRouter ?? new RuleBasedIntentRouter();
  }
  async route(context) {
    if (!context.hasTools) {
      return { mode: "chat", reason: "no-tools" };
    }
    const messages = [
      {
        role: "system",
        content: this.options.systemPrompt || DEFAULT_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: [
          `User message: ${context.message}`,
          `Available tools: ${context.availableTools.join(", ") || "none"}`
        ].join("\n")
      }
    ];
    try {
      const response = await this.provider.chat({
        messages,
        temperature: this.options.temperature ?? 0.1
      });
      const decision = parseIntentDecision(response.content);
      if (!decision) {
        return await this.fallbackRouter.route(context);
      }
      return normalizeIntentDecision(decision, context);
    } catch (error) {
      console.error("[IntentRouter] Failed to route with LLM:", error);
      return await this.fallbackRouter.route(context);
    }
  }
};
function parseIntentDecision(content) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
function normalizeIntentDecision(decision, context) {
  const mode = decision.mode === "agent" ? "agent" : "chat";
  const allowedTools = decision.toolPolicy?.allowedTools || decision.allowedTools;
  const enableMemory = decision.memoryPolicy?.enableMemory ?? decision.enableMemory;
  const enableChatMemory = decision.memoryPolicy?.enableChatMemory ?? decision.enableChatMemory;
  const normalized = {
    mode,
    reason: decision.reason,
    toolPolicy: void 0,
    memoryPolicy: void 0
  };
  if (Array.isArray(allowedTools) && allowedTools.length > 0) {
    normalized.toolPolicy = {
      allowedTools: allowedTools.filter((tool) => context.availableTools.includes(tool))
    };
  }
  if (enableMemory !== void 0 || enableChatMemory !== void 0) {
    normalized.memoryPolicy = {
      enableMemory: enableMemory === void 0 ? void 0 : Boolean(enableMemory),
      enableChatMemory: enableChatMemory === void 0 ? void 0 : Boolean(enableChatMemory)
    };
  }
  if (!context.hasTools) {
    normalized.mode = "chat";
  }
  return normalized;
}

// src/core/audit.ts
function createEventStreamAuditLogger(eventStream) {
  return {
    log(entry) {
      const timestamp = entry.timestamp ?? Date.now();
      eventStream.emit("audit", entry.status, entry.action, {
        metadata: {
          actor: entry.actor,
          roles: entry.roles,
          ...entry.metadata
        },
        payload: {
          ...entry,
          timestamp
        }
      });
    }
  };
}

// src/core/rbac.ts
function resolveRoles(policy, roles) {
  if (roles && roles.length > 0) return roles;
  return policy.defaultRoles ? [...policy.defaultRoles] : [];
}
function resolvePermissions(policy, roles) {
  const permissions = {};
  for (const role of roles) {
    const grants = policy.roles[role] || [];
    for (const permission of grants) {
      permissions[permission] = true;
    }
  }
  return permissions;
}

// src/core/memory/chat-memory.ts
var DEFAULT_CHAT_MEMORY_RECALL_POLICY = {
  limit: 5,
  messageRole: "system"
};
var DEFAULT_CHAT_MEMORY_SAVE_POLICY = {
  saveUserPreferences: true,
  saveConversationTurns: false,
  saveIntentMessages: false,
  minMessageLength: 20,
  importance: 0.85,
  longTerm: true
};
function applyChatMemoryRecallPolicy(memories, policy) {
  let filtered = memories;
  if (policy.minImportance !== void 0) {
    filtered = filtered.filter((memory) => memory.metadata.importance >= policy.minImportance);
  }
  if (policy.tags && policy.tags.length > 0) {
    filtered = filtered.filter((memory) => {
      if (!memory.metadata.tags) return false;
      return memory.metadata.tags.some((tag) => policy.tags.includes(tag));
    });
  }
  const limit = policy.limit ?? DEFAULT_CHAT_MEMORY_RECALL_POLICY.limit;
  return filtered.slice(0, limit);
}
function formatChatMemories(memories) {
  const lines = memories.map((memory) => normalizeMemoryContent(memory.content)).filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return `Relevant memory: ${lines[0]}`;
  return `Relevant memories:
${lines.map((line) => `- ${line}`).join("\n")}`;
}
async function saveChatMemoryTurn(memory, userMessage, assistantMessage, policy = {}) {
  const resolvedPolicy = {
    ...DEFAULT_CHAT_MEMORY_SAVE_POLICY,
    ...policy
  };
  const baseTags = policy.tags ?? [];
  if (resolvedPolicy.saveIntentMessages) {
    const patterns = policy.intentPatterns ?? DEFAULT_INTENT_PATTERNS;
    const intentMemory = extractIntentMemory(userMessage, patterns);
    if (intentMemory) {
      await memory.remember(intentMemory, {
        tags: uniqueTags(["explicit-memory", "conversation", ...baseTags]),
        importance: resolvedPolicy.intentImportance ?? Math.max(0.9, resolvedPolicy.importance),
        longTerm: resolvedPolicy.longTerm
      });
    }
  }
  if (resolvedPolicy.saveUserPreferences) {
    const patterns = policy.preferencePatterns ?? DEFAULT_PREFERENCE_PATTERNS;
    if (isPreferenceStatement(userMessage, patterns)) {
      await memory.remember(userMessage, {
        tags: uniqueTags(["user-preference", "conversation", ...baseTags]),
        importance: resolvedPolicy.importance,
        longTerm: resolvedPolicy.longTerm
      });
    }
  }
  if (resolvedPolicy.saveConversationTurns) {
    const trimmed = userMessage.trim();
    if (trimmed.length >= resolvedPolicy.minMessageLength) {
      await memory.remember(
        {
          user: trimmed,
          assistant: assistantMessage
        },
        {
          tags: uniqueTags(["conversation-turn", ...baseTags]),
          importance: Math.min(resolvedPolicy.importance, 0.7),
          longTerm: resolvedPolicy.longTerm
        }
      );
    }
  }
}
function uniqueTags(tags) {
  return Array.from(new Set(tags)).filter(Boolean);
}

// src/core/agent.ts
var Agent = class {
  constructor(config) {
    __publicField(this, "provider");
    __publicField(this, "toolRegistry");
    __publicField(this, "runner", null);
    __publicField(this, "eventStream", null);
    __publicField(this, "abortController");
    __publicField(this, "isRunning", false);
    __publicField(this, "lastState", null);
    __publicField(this, "config");
    __publicField(this, "intentRouter");
    __publicField(this, "conversationHistory", []);
    __publicField(this, "auditLogger");
    this.config = {
      provider: config.provider,
      tools: config.tools || [],
      mode: config.mode || "auto",
      systemPrompt: config.systemPrompt || "You are a helpful AI assistant.",
      streaming: config.streaming ?? true,
      maxSteps: config.maxSteps || 15,
      hooks: config.hooks || {},
      useLLMResponder: config.useLLMResponder ?? false,
      confirmTool: config.confirmTool,
      memory: config.memory,
      enableMemory: config.enableMemory ?? false,
      rbac: config.rbac,
      auditLogger: config.auditLogger,
      enableIntentRouter: config.enableIntentRouter ?? false,
      intentRouter: config.intentRouter,
      intentRouterOptions: config.intentRouterOptions,
      enableChatMemory: config.enableChatMemory ?? false,
      chatMemorySavePolicy: config.chatMemorySavePolicy,
      chatMemoryRecallPolicy: config.chatMemoryRecallPolicy
    };
    this.provider = this.createProvider(this.config.provider);
    this.toolRegistry = new ToolRegistry();
    this.abortController = new AgentAbortController();
    this.intentRouter = this.createIntentRouter();
    this.config.tools.forEach((tool) => this.toolRegistry.register(tool));
    this.initializeRunner();
    this.auditLogger = this.config.auditLogger ?? (this.eventStream ? createEventStreamAuditLogger(this.eventStream) : void 0);
  }
  createProvider(config) {
    if ("type" in config) {
      return createLLMProvider(config);
    }
    return createProviderFromSettings(config);
  }
  createIntentRouter() {
    if (this.config.intentRouter) {
      return this.config.intentRouter;
    }
    if (!this.config.enableIntentRouter) {
      return void 0;
    }
    return new LLMIntentRouter(this.provider, this.config.intentRouterOptions);
  }
  initializeRunner() {
    const planner = new LLMPlannerNode(this.toolRegistry, { provider: this.provider });
    const toolRunner = new ToolRunnerNode(this.toolRegistry, { provider: this.provider });
    const confirmer = new ConfirmationNode({ onConfirm: this.config.confirmTool });
    const verifier = new VerifierNode();
    const responder = this.config.useLLMResponder ? new LLMResponderNode({ provider: this.provider }) : new ResponderNode();
    const nodes = [
      planner,
      toolRunner,
      confirmer,
      verifier,
      responder
    ];
    let memoryNode = null;
    if (this.config.enableMemory && this.config.memory) {
      memoryNode = new MemoryNode({
        memoryManager: this.config.memory,
        saveCompletedTasks: true,
        saveUserPreferences: true,
        saveToolResults: false
      });
      nodes.push(memoryNode);
    }
    const graph = {
      nodes,
      edges: [
        { from: "planner", to: "tool-runner" },
        {
          from: "tool-runner",
          to: "confirmation",
          condition: (s) => s.task.pendingToolCall?.status === "pending"
        },
        { from: "tool-runner", to: "verifier" },
        { from: "confirmation", to: "tool-runner" },
        { from: "verifier", to: "responder", condition: (s) => s.task.currentStepIndex >= s.task.steps.length },
        { from: "verifier", to: "tool-runner", condition: (s) => s.task.currentStepIndex < s.task.steps.length },
        // Add memory node after responder (if enabled)
        ...memoryNode ? [{ from: "responder", to: "memory" }] : []
      ],
      entryNode: "planner",
      maxSteps: this.config.maxSteps
    };
    this.runner = new GraphRunner(graph, void 0, this.config.hooks);
    this.eventStream = this.runner.getEventStream();
  }
  /** 主入口：发送消息并获取回复 */
  async chat(message, options = {}) {
    if (this.isRunning) {
      throw new Error("Agent is already running. Call abort() first.");
    }
    this.isRunning = true;
    this.abortController.reset();
    const startTime = Date.now();
    const decision = await this.determineRouting(message);
    const mode = decision.mode;
    this.logAudit({
      action: "route_decision",
      status: "info",
      metadata: {
        mode,
        reason: decision.reason,
        allowedTools: decision.toolPolicy?.allowedTools,
        memoryPolicy: decision.memoryPolicy
      }
    });
    this.conversationHistory.push({ role: "user", content: message });
    try {
      if (mode === "chat") {
        return await this.handleChatMode(message, options, startTime, decision);
      }
      return await this.handleAgentMode(message, startTime, decision);
    } catch (error) {
      if (isAbortError(error)) {
        return {
          content: "[\u4EFB\u52A1\u5DF2\u4E2D\u65AD]",
          mode,
          duration: Date.now() - startTime,
          aborted: true,
          abortReason: this.abortController.getAbortState().reason
        };
      }
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  async determineRouting(message) {
    if (this.config.mode === "chat") return { mode: "chat", reason: "config" };
    if (this.config.mode === "agent") return { mode: "agent", reason: "config" };
    const hasTools = this.toolRegistry.list().length > 0;
    if (!this.intentRouter) {
      return {
        mode: shouldUseAgentMode(message, hasTools) ? "agent" : "chat",
        reason: "rule-based"
      };
    }
    const decision = await this.intentRouter.route({
      message,
      hasTools,
      availableTools: this.toolRegistry.list()
    });
    if (!hasTools && decision.mode === "agent") {
      return { ...decision, mode: "chat" };
    }
    return decision;
  }
  async handleChatMode(message, options, startTime, decision) {
    const messages = [{ role: "system", content: this.config.systemPrompt }];
    const rbac = this.resolveRBAC();
    const canRecall = this.isPermissionAllowed(rbac.permissions, "memory:read");
    const canWrite = this.isPermissionAllowed(rbac.permissions, "memory:write");
    const useChatMemory = options.useChatMemory ?? decision?.memoryPolicy?.enableChatMemory ?? this.config.enableChatMemory;
    if (useChatMemory && this.config.memory) {
      const recallPolicy = this.mergeChatMemoryRecallPolicy(options.chatMemoryRecallPolicy);
      if (canRecall) {
        const memoryMessage = await this.buildChatMemoryMessage(message, recallPolicy);
        if (memoryMessage) {
          messages.push(memoryMessage);
        }
      } else {
        this.logAudit({
          action: "memory_recall_blocked",
          status: "warning",
          metadata: { scope: "chat", reason: "permission" }
        });
      }
    }
    messages.push(...this.conversationHistory);
    const useStream = options.stream ?? this.config.streaming;
    if (useStream && options.onStream) {
      let fullContent = "";
      let usage;
      const stream = this.provider.chatStream({
        messages,
        temperature: options.temperature,
        signal: this.abortController.signal
      });
      for await (const chunk of stream) {
        if (chunk.delta) {
          fullContent += chunk.delta;
          options.onStream(chunk.delta);
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }
      this.conversationHistory.push({ role: "assistant", content: fullContent });
      if (useChatMemory && this.config.memory) {
        if (!canWrite) {
          this.logAudit({
            action: "memory_save_blocked",
            status: "warning",
            metadata: { scope: "chat", reason: "permission" }
          });
        } else {
          await this.saveChatMemory(message, fullContent, options.chatMemorySavePolicy);
        }
      }
      return {
        content: fullContent,
        mode: "chat",
        duration: Date.now() - startTime,
        usage
      };
    }
    const response = await this.provider.chat({
      messages,
      temperature: options.temperature,
      signal: this.abortController.signal
    });
    this.conversationHistory.push({ role: "assistant", content: response.content });
    if (useChatMemory && this.config.memory) {
      if (!canWrite) {
        this.logAudit({
          action: "memory_save_blocked",
          status: "warning",
          metadata: { scope: "chat", reason: "permission" }
        });
      } else {
        await this.saveChatMemory(message, response.content, options.chatMemorySavePolicy);
      }
    }
    return {
      content: response.content,
      usage: response.usage,
      mode: "chat",
      duration: Date.now() - startTime
    };
  }
  async handleAgentMode(message, startTime, decision) {
    if (!this.runner) throw new Error("GraphRunner not initialized");
    let relevantMemories = [];
    const memoryEnabled = decision?.memoryPolicy?.enableMemory ?? this.config.enableMemory;
    const rbac = this.resolveRBAC();
    const permissions = rbac.permissions ?? { "sql:read": true, "document:read": true };
    const roles = rbac.roles;
    const canRecall = this.isPermissionAllowed(rbac.permissions, "memory:read");
    const canWrite = this.isPermissionAllowed(rbac.permissions, "memory:write");
    const memoryEnabledForWrite = memoryEnabled && canWrite;
    if (memoryEnabled && this.config.memory) {
      if (!canRecall) {
        this.logAudit({
          action: "memory_recall_blocked",
          status: "warning",
          metadata: { scope: "agent", reason: "permission" }
        });
      } else {
        relevantMemories = await this.recallRelevantMemories(message);
      }
    }
    const initialState = createState(message, {
      permissions,
      allowedTools: decision?.toolPolicy?.allowedTools,
      memoryEnabled: memoryEnabledForWrite,
      roles
    });
    if (relevantMemories.length > 0) {
      initialState.memory.shortTerm["recalled_context"] = relevantMemories;
    }
    const result = await this.abortController.wrapWithAbort(
      this.runner.execute(initialState)
    );
    const finalState = result.state;
    this.lastState = finalState;
    const lastMessage = finalState.conversation.messages.filter((m) => m.role === "assistant").pop();
    const content = lastMessage?.content || formatAgentResponse(
      finalState.task.goal,
      finalState.task.steps.map((s) => ({ description: s.description, status: s.status }))
    );
    this.conversationHistory.push({ role: "assistant", content });
    return {
      content,
      mode: "agent",
      steps: finalState.task.steps.map((s) => ({ description: s.description, status: s.status, result: s.result })),
      duration: Date.now() - startTime,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: finalState.telemetry.tokenCount }
    };
  }
  /**
   * Recall relevant memories for a given query
   */
  async recallRelevantMemories(query) {
    if (!this.config.memory) return [];
    try {
      const memories = await this.config.memory.recall(query);
      this.eventStream?.emit("memory_recall", "info", "Recalled agent memories", {
        metadata: {
          query,
          count: memories.length,
          source: "agent"
        }
      });
      this.logAudit({
        action: "memory_recall",
        status: "info",
        metadata: { scope: "agent", query, count: memories.length }
      });
      return memories.slice(0, 5).map((m) => normalizeMemoryContent(m.content));
    } catch (error) {
      console.error("[Agent] Failed to recall memories:", error);
      return [];
    }
  }
  mergeChatMemoryRecallPolicy(override) {
    return {
      ...DEFAULT_CHAT_MEMORY_RECALL_POLICY,
      ...this.config.chatMemoryRecallPolicy,
      ...override
    };
  }
  mergeChatMemorySavePolicy(override) {
    return {
      ...DEFAULT_CHAT_MEMORY_SAVE_POLICY,
      ...this.config.chatMemorySavePolicy,
      ...override
    };
  }
  async buildChatMemoryMessage(query, policy) {
    if (!this.config.memory) return null;
    try {
      const memories = await this.config.memory.recall(query);
      this.eventStream?.emit("memory_recall", "info", "Recalled chat memories", {
        metadata: {
          query,
          count: memories.length,
          source: "chat"
        }
      });
      this.logAudit({
        action: "memory_recall",
        status: "info",
        metadata: { scope: "chat", query, count: memories.length }
      });
      const filtered = applyChatMemoryRecallPolicy(memories, policy);
      const formatted = formatChatMemories(filtered);
      if (!formatted) return null;
      const role = policy.messageRole ?? DEFAULT_CHAT_MEMORY_RECALL_POLICY.messageRole;
      return { role, content: formatted };
    } catch (error) {
      console.error("[Agent] Failed to recall chat memories:", error);
      return null;
    }
  }
  async saveChatMemory(userMessage, assistantMessage, overridePolicy) {
    if (!this.config.memory) return;
    const savePolicy = this.mergeChatMemorySavePolicy(overridePolicy);
    try {
      await saveChatMemoryTurn(this.config.memory, userMessage, assistantMessage, savePolicy);
      this.eventStream?.emit("memory_save", "info", "Saved chat memory", {
        metadata: {
          source: "chat",
          saveIntentMessages: !!savePolicy.saveIntentMessages,
          saveUserPreferences: !!savePolicy.saveUserPreferences,
          saveConversationTurns: !!savePolicy.saveConversationTurns
        }
      });
      this.logAudit({
        action: "memory_save",
        status: "info",
        metadata: {
          scope: "chat",
          saveIntentMessages: !!savePolicy.saveIntentMessages,
          saveUserPreferences: !!savePolicy.saveUserPreferences,
          saveConversationTurns: !!savePolicy.saveConversationTurns
        }
      });
    } catch (error) {
      console.error("[Agent] Failed to save chat memories:", error);
    }
  }
  resolveRBAC() {
    const policy = this.config.rbac?.policy;
    if (!policy) return {};
    const roles = resolveRoles(policy, this.config.rbac?.roles);
    const permissions = resolvePermissions(policy, roles);
    return { roles, permissions };
  }
  isPermissionAllowed(permissions, permission) {
    if (!permissions) return true;
    return permissions[permission] === true;
  }
  logAudit(entry) {
    if (!this.auditLogger) return;
    const policy = this.config.rbac?.policy;
    const roles = policy ? resolveRoles(policy, this.config.rbac?.roles) : this.config.rbac?.roles;
    this.auditLogger.log({
      ...entry,
      actor: this.config.rbac?.actor,
      roles
    });
  }
  // Public API
  getEventStream() {
    if (!this.eventStream) {
      throw new Error("EventStream not initialized");
    }
    return this.eventStream;
  }
  getToolRegistry() {
    return this.toolRegistry;
  }
  getProvider() {
    return this.provider;
  }
  getHistory() {
    return [...this.conversationHistory];
  }
  getMemory() {
    return this.config.memory;
  }
  getGraphDefinition() {
    return this.runner?.getGraphDefinition();
  }
  registerTool(tool) {
    this.toolRegistry.register(tool);
  }
  clearHistory() {
    this.conversationHistory = [];
  }
  setHistory(history) {
    this.conversationHistory = [...history];
  }
  // ========================================================================
  // Abort/Resume API
  // ========================================================================
  /**
   * 中断当前执行
   * @param reason 中断原因
   */
  abort(reason) {
    if (!this.isRunning) {
      console.warn("Agent is not running, nothing to abort.");
      return;
    }
    this.abortController.abort(reason);
    this.eventStream?.emit("abort", "warning", reason || "User initiated abort");
  }
  /**
   * 从最近的 checkpoint 恢复执行
   * @param options 恢复选项
   */
  async resume(options = {}) {
    if (this.isRunning) {
      throw new Error("Agent is already running.");
    }
    const checkpointId = options.fromCheckpoint;
    let resumeState = null;
    if (checkpointId) {
      const checkpoint = this.abortController.getCheckpoint(checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint "${checkpointId}" not found.`);
      }
      resumeState = checkpoint.state;
    } else {
      const latestCheckpoint = this.abortController.getLatestCheckpoint();
      resumeState = latestCheckpoint?.state || this.lastState;
    }
    if (!resumeState) {
      throw new Error("No state available to resume from.");
    }
    if (options.modifiedState) {
      resumeState = {
        ...resumeState,
        ...options.modifiedState,
        updatedAt: Date.now()
      };
    }
    this.isRunning = true;
    this.abortController.reset();
    const startTime = Date.now();
    try {
      if (!this.runner) throw new Error("GraphRunner not initialized");
      this.eventStream?.emit("resume", "info", "Resuming from checkpoint");
      const result = await this.runner.execute(resumeState);
      const finalState = result.state;
      this.lastState = finalState;
      const lastMessage = finalState.conversation.messages.filter((m) => m.role === "assistant").pop();
      const content = lastMessage?.content || formatAgentResponse(
        finalState.task.goal,
        finalState.task.steps.map((s) => ({ description: s.description, status: s.status }))
      );
      this.conversationHistory.push({ role: "assistant", content });
      return {
        content,
        mode: "agent",
        steps: finalState.task.steps.map((s) => ({
          description: s.description,
          status: s.status,
          result: s.result
        })),
        duration: Date.now() - startTime,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: finalState.telemetry.tokenCount }
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          content: "[\u4EFB\u52A1\u5DF2\u4E2D\u65AD]",
          mode: "agent",
          duration: Date.now() - startTime,
          aborted: true,
          abortReason: this.abortController.getAbortState().reason
        };
      }
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  /**
   * 检查 Agent 是否正在运行
   */
  isAgentRunning() {
    return this.isRunning;
  }
  /**
   * 获取 AbortController
   */
  getAbortController() {
    return this.abortController;
  }
  /**
   * 获取可用的 checkpoints
   */
  listCheckpoints() {
    return this.abortController.listCheckpoints();
  }
};
function createAgent(config) {
  return new Agent(config);
}

// src/core/debug-bundle.ts
function createDebugBundle(state, eventStream, options) {
  return {
    version: "0.1.0",
    timestamp: Date.now(),
    state,
    events: eventStream.export(),
    checkpoints: options?.checkpoints,
    metadata: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : void 0,
      platform: typeof navigator !== "undefined" ? navigator.platform : void 0,
      ...options?.metadata
    }
  };
}
function exportDebugBundle(bundle) {
  return JSON.stringify(bundle, null, 2);
}
function downloadDebugBundle(bundle, filename) {
  const json = exportDebugBundle(bundle);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `debug-bundle-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importDebugBundle(json) {
  return JSON.parse(json);
}

// src/nodes/planner.ts
var PlannerNode = class extends BaseNode {
  constructor() {
    super("planner", "Planner");
  }
  async execute(state) {
    const events = [];
    const startTime = Date.now();
    try {
      const plan = await this.generatePlan(state.task.goal);
      const steps = this.parseSteps(plan);
      const newState = updateState(state, (draft) => {
        draft.task.plan = plan;
        draft.task.steps = steps;
        draft.task.progress = 10;
      });
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "node_end",
        nodeId: this.id,
        status: "success",
        summary: `\u751F\u6210\u4E86 ${steps.length} \u4E2A\u5B50\u4EFB\u52A1`,
        metadata: { stepCount: steps.length }
      });
      return this.createResult(newState, events);
    } catch (error) {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        nodeId: this.id,
        status: "failure",
        summary: `\u89C4\u5212\u5931\u8D25: ${error}`
      });
      throw error;
    }
  }
  /**
   * 生成计划（简化版规则引擎）
   * 实际项目中应调用 LLM API
   */
  async generatePlan(goal) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (goal.includes("SQL") || goal.includes("sql")) {
      return `1. \u5206\u6790\u5F53\u524D SQL \u8BED\u53E5
2. \u8BC6\u522B\u4F18\u5316\u70B9
3. \u751F\u6210\u4F18\u5316\u540E\u7684 SQL
4. \u9A8C\u8BC1\u7ED3\u679C\u4E00\u81F4\u6027`;
    }
    if (goal.includes("\u6587\u6863") || goal.includes("\u641C\u7D22")) {
      return `1. \u89E3\u6790\u641C\u7D22\u5173\u952E\u8BCD
2. \u68C0\u7D22\u76F8\u5173\u6587\u6863
3. \u63D0\u53D6\u5173\u952E\u4FE1\u606F
4. \u6C47\u603B\u7ED3\u679C`;
    }
    return `1. \u7406\u89E3\u7528\u6237\u9700\u6C42
2. \u6536\u96C6\u5FC5\u8981\u4FE1\u606F
3. \u6267\u884C\u76F8\u5173\u64CD\u4F5C
4. \u9A8C\u8BC1\u7ED3\u679C
5. \u751F\u6210\u7B54\u590D`;
  }
  /**
   * 解析步骤
   */
  parseSteps(plan) {
    const lines = plan.split("\n").filter((line) => line.trim());
    return lines.map((line, index) => ({
      id: `step-${index + 1}`,
      description: line.replace(/^\d+\.\s*/, ""),
      // 移除序号
      status: "pending"
    }));
  }
};

// src/tools/example-tools.ts
var sqlQueryTool = {
  name: "sql-query",
  description: 'Execute SQL SELECT queries on the database. Use this tool when the user wants to query data, list records, or get information from the database. Examples: "show all users", "list products", "get customer data".',
  inputSchema: external_exports.object({
    query: external_exports.string().min(1, "Query cannot be empty").describe("The SQL SELECT query to execute"),
    database: external_exports.string().optional().describe("Optional database name")
  }),
  outputSchema: external_exports.object({
    rows: external_exports.array(external_exports.record(external_exports.unknown())),
    rowCount: external_exports.number(),
    executionTime: external_exports.number()
  }),
  timeout: 5e3,
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1e3,
    backoffMultiplier: 2
  },
  permissions: ["sql:read"],
  requiresConfirmation: true,
  confirmationMessage: "Execute database query?",
  allowedNodes: ["tool-runner"],
  async execute(input) {
    const { query } = input;
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }
    console.log("[SQL-Query] Executing:", query);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      rows: [
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" },
        { id: 3, name: "Charlie", email: "charlie@example.com" }
      ],
      rowCount: 3,
      executionTime: 100
    };
  }
};
var documentSearchTool = {
  name: "document-search",
  description: 'Search for documents and articles in the knowledge base. Use this tool when the user wants to find documentation, tutorials, guides, or articles. Examples: "find SQL optimization docs", "search for performance guide", "look up tutorial".',
  inputSchema: external_exports.object({
    keywords: external_exports.array(external_exports.string()).min(1, "At least one keyword required").describe("Keywords to search for"),
    limit: external_exports.number().min(1).max(50).optional().default(10).describe("Maximum number of results")
  }),
  outputSchema: external_exports.object({
    documents: external_exports.array(external_exports.object({
      id: external_exports.string(),
      title: external_exports.string(),
      snippet: external_exports.string(),
      relevance: external_exports.number()
    })),
    totalCount: external_exports.number()
  }),
  timeout: 3e3,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 500,
    backoffMultiplier: 2
  },
  permissions: ["document:read"],
  async execute(input) {
    const { keywords, limit = 10 } = input;
    await new Promise((resolve) => setTimeout(resolve, 200));
    const mockDocs = [
      {
        id: "doc-1",
        title: "SQL \u4F18\u5316\u6700\u4F73\u5B9E\u8DF5",
        snippet: "\u672C\u6587\u4ECB\u7ECD\u4E86\u5E38\u89C1\u7684 SQL \u4F18\u5316\u6280\u5DE7\uFF0C\u5305\u62EC\u7D22\u5F15\u4F7F\u7528\u3001\u67E5\u8BE2\u91CD\u5199\u7B49...",
        relevance: 0.95
      },
      {
        id: "doc-2",
        title: "\u6570\u636E\u5E93\u6027\u80FD\u8C03\u4F18\u6307\u5357",
        snippet: "\u6DF1\u5165\u63A2\u8BA8\u6570\u636E\u5E93\u6027\u80FD\u8C03\u4F18\u7684\u5404\u4E2A\u65B9\u9762\uFF0C\u4ECE\u786C\u4EF6\u5230\u67E5\u8BE2\u4F18\u5316...",
        relevance: 0.87
      },
      {
        id: "doc-3",
        title: "PostgreSQL \u67E5\u8BE2\u4F18\u5316\u5668\u539F\u7406",
        snippet: "\u8BE6\u7EC6\u89E3\u6790 PostgreSQL \u67E5\u8BE2\u4F18\u5316\u5668\u7684\u5DE5\u4F5C\u539F\u7406\u548C\u4F18\u5316\u7B56\u7565...",
        relevance: 0.76
      }
    ];
    return {
      documents: mockDocs.slice(0, limit),
      totalCount: mockDocs.length
    };
  }
};
function getExampleTools() {
  return [sqlQueryTool, documentSearchTool];
}

// src/core/llm-service/cache.ts
var LLMCache = class {
  constructor(config) {
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "config");
    __publicField(this, "accessOrder", []);
    this.config = config;
  }
  /**
   * 生成缓存键
   */
  generateKey(request) {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }
    const keyData = {
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      temperature: request.temperature ?? 0.7
    };
    return this.hashString(JSON.stringify(keyData));
  }
  /**
   * 简单的字符串哈希
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  /**
   * 获取缓存
   */
  get(key) {
    if (!this.config.enabled) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }
    entry.hits++;
    this.updateAccessOrder(key);
    return entry.response;
  }
  /**
   * 设置缓存
   */
  set(key, response) {
    if (!this.config.enabled) return;
    while (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hits: 0
    });
    this.accessOrder.push(key);
  }
  /**
   * 更新访问顺序
   */
  updateAccessOrder(key) {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }
  /**
   * 从访问顺序中移除
   */
  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  /**
   * 淘汰最旧的条目（LRU）
   */
  evictOldest() {
    if (this.accessOrder.length === 0) return;
    const oldestKey = this.accessOrder.shift();
    this.cache.delete(oldestKey);
  }
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }
  /**
   * 获取缓存统计
   */
  getStats() {
    let totalHits = 0;
    let totalAccess = 0;
    this.cache.forEach((entry) => {
      totalHits += entry.hits;
      totalAccess += entry.hits + 1;
    });
    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0
    };
  }
  /**
   * 使指定键的缓存失效
   */
  invalidate(key) {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return existed;
  }
  /**
   * 清理过期条目
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        removed++;
      }
    }
    return removed;
  }
};

// src/core/llm-service/stats.ts
var LLMStatsCollector = class {
  constructor(options = {}) {
    __publicField(this, "history", []);
    __publicField(this, "maxHistory");
    __publicField(this, "enabled");
    this.maxHistory = options.maxHistory ?? 1e3;
    this.enabled = options.enabled ?? true;
  }
  /**
   * 记录一次调用
   */
  record(stats) {
    if (!this.enabled) return;
    this.history.push(stats);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
  /**
   * 获取聚合统计
   */
  getAggregateStats() {
    const stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalDuration: 0,
      averageDuration: 0,
      byProvider: {},
      byModel: {}
    };
    for (const call of this.history) {
      stats.totalRequests++;
      stats.totalDuration += call.duration;
      if (call.success) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
      }
      if (call.cached) {
        stats.cacheHits++;
      }
      if (call.usage) {
        stats.totalTokens += call.usage.totalTokens;
        stats.totalPromptTokens += call.usage.promptTokens;
        stats.totalCompletionTokens += call.usage.completionTokens;
      }
      if (!stats.byProvider[call.providerName]) {
        stats.byProvider[call.providerName] = {
          requests: 0,
          successes: 0,
          failures: 0,
          totalTokens: 0,
          totalDuration: 0
        };
      }
      const providerStats = stats.byProvider[call.providerName];
      providerStats.requests++;
      providerStats.totalDuration += call.duration;
      if (call.success) providerStats.successes++;
      else providerStats.failures++;
      if (call.usage) providerStats.totalTokens += call.usage.totalTokens;
      if (!stats.byModel[call.model]) {
        stats.byModel[call.model] = {
          requests: 0,
          successes: 0,
          failures: 0,
          totalTokens: 0,
          averageTokensPerRequest: 0
        };
      }
      const modelStats = stats.byModel[call.model];
      modelStats.requests++;
      if (call.success) modelStats.successes++;
      else modelStats.failures++;
      if (call.usage) modelStats.totalTokens += call.usage.totalTokens;
    }
    if (stats.totalRequests > 0) {
      stats.averageDuration = stats.totalDuration / stats.totalRequests;
    }
    for (const model in stats.byModel) {
      const modelStats = stats.byModel[model];
      if (modelStats.requests > 0) {
        modelStats.averageTokensPerRequest = modelStats.totalTokens / modelStats.requests;
      }
    }
    return stats;
  }
  /**
   * 获取最近 N 次调用的统计
   */
  getRecentStats(count = 10) {
    return this.history.slice(-count);
  }
  /**
   * 获取指定时间范围内的统计
   */
  getStatsInTimeRange(startTime, endTime) {
    return this.history.filter(
      (call) => call.startTime >= startTime && call.endTime <= endTime
    );
  }
  /**
   * 获取失败的调用
   */
  getFailedCalls() {
    return this.history.filter((call) => !call.success);
  }
  /**
   * 获取成功率
   */
  getSuccessRate() {
    if (this.history.length === 0) return 1;
    const successful = this.history.filter((call) => call.success).length;
    return successful / this.history.length;
  }
  /**
   * 获取平均响应时间
   */
  getAverageResponseTime() {
    if (this.history.length === 0) return 0;
    const totalDuration = this.history.reduce((sum, call) => sum + call.duration, 0);
    return totalDuration / this.history.length;
  }
  /**
   * 获取 token 使用摘要
   */
  getTokenUsageSummary() {
    const summary = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      count: 0
    };
    for (const call of this.history) {
      if (call.usage) {
        summary.promptTokens += call.usage.promptTokens;
        summary.completionTokens += call.usage.completionTokens;
        summary.totalTokens += call.usage.totalTokens;
        summary.count++;
      }
    }
    return summary;
  }
  /**
   * 清空统计历史
   */
  clear() {
    this.history = [];
  }
  /**
   * 导出统计数据
   */
  export() {
    return {
      history: [...this.history],
      aggregate: this.getAggregateStats(),
      exportedAt: Date.now()
    };
  }
  /**
   * 启用/禁用统计收集
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  /**
   * 检查是否启用
   */
  isEnabled() {
    return this.enabled;
  }
};

// src/core/llm-service/types.ts
var DEFAULT_LLM_SERVICE_CONFIG = {
  defaultTimeout: 6e4,
  retry: {
    maxRetries: 3,
    initialBackoff: 1e3,
    maxBackoff: 3e4,
    backoffMultiplier: 2,
    retryableErrors: ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "fetch failed", "network error"]
  },
  cache: {
    enabled: false,
    ttl: 5 * 60 * 1e3,
    // 5 分钟
    maxEntries: 100
  },
  rateLimit: {
    enabled: false,
    windowMs: 6e4,
    // 1 分钟
    maxRequests: 60
  },
  enableStats: true,
  maxStatsHistory: 1e3
};

// src/core/llm-service/service.ts
function generateRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetryableError(error, retryableErrors) {
  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some((re) => errorMessage.includes(re.toLowerCase()));
}
var LLMService = class {
  constructor(provider, config = {}) {
    __publicField(this, "provider");
    __publicField(this, "config");
    __publicField(this, "cache");
    __publicField(this, "stats");
    __publicField(this, "requestMiddlewares", []);
    __publicField(this, "responseMiddlewares", []);
    __publicField(this, "errorMiddlewares", []);
    __publicField(this, "rateLimitState", {
      count: 0,
      windowStart: Date.now()
    });
    this.provider = provider;
    this.config = { ...DEFAULT_LLM_SERVICE_CONFIG, ...config };
    this.cache = new LLMCache(this.config.cache);
    this.stats = new LLMStatsCollector({
      maxHistory: this.config.maxStatsHistory,
      enabled: this.config.enableStats
    });
  }
  // ========================================================================
  // 主要 API
  // ========================================================================
  /**
   * 发送聊天请求（非流式）
   */
  async chat(request, options = {}) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context = {
      requestId,
      startTime,
      providerName: this.provider.getProviderName(),
      model: this.provider.getModel(),
      retryCount: 0,
      request,
      options
    };
    try {
      await this.checkRateLimit();
      if (!options.skipCache) {
        const cacheKey = this.cache.generateKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          const result2 = this.createResult(cached, context, true);
          this.recordStats(context, result2, true);
          return result2;
        }
      }
      let processedRequest = request;
      for (const middleware of this.requestMiddlewares) {
        processedRequest = await middleware.process(processedRequest, context);
      }
      const response = await this.executeWithRetry(processedRequest, context, options);
      let processedResponse = response;
      for (const middleware of this.responseMiddlewares) {
        processedResponse = await middleware.process(processedResponse, context);
      }
      if (!options.skipCache) {
        const cacheKey = this.cache.generateKey(request);
        this.cache.set(cacheKey, processedResponse);
      }
      const result = this.createResult(processedResponse, context, false);
      this.recordStats(context, result, true);
      return result;
    } catch (error) {
      for (const middleware of this.errorMiddlewares) {
        const recovered = await middleware.process(error, context);
        if (recovered) {
          const result = this.createResult(recovered, context, false);
          this.recordStats(context, result, true);
          return result;
        }
      }
      this.recordStats(context, null, false, error.message);
      throw error;
    }
  }
  /**
   * 发送聊天请求（流式）
   */
  async chatStream(request, options = {}) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    let aborted = false;
    const context = {
      requestId,
      startTime,
      providerName: this.provider.getProviderName(),
      model: this.provider.getModel(),
      retryCount: 0,
      request,
      options
    };
    await this.checkRateLimit();
    let processedRequest = request;
    for (const middleware of this.requestMiddlewares) {
      processedRequest = await middleware.process(processedRequest, context);
    }
    const self = this;
    async function* wrappedStream() {
      try {
        const stream = self.provider.chatStream(processedRequest);
        for await (const chunk of stream) {
          if (aborted || options.signal?.aborted) {
            break;
          }
          yield chunk;
        }
      } catch (error) {
        self.recordStats(context, null, false, error.message);
        throw error;
      }
    }
    return {
      requestId,
      stream: wrappedStream(),
      abort: () => {
        aborted = true;
      }
    };
  }
  /**
   * 简便方法：发送单条消息
   */
  async complete(prompt, systemPrompt, options = {}) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    const result = await this.chat({ messages }, options);
    return result.content;
  }
  // ========================================================================
  // 中间件管理
  // ========================================================================
  /**
   * 添加请求中间件
   */
  useRequest(middleware) {
    this.requestMiddlewares.push(middleware);
    return this;
  }
  /**
   * 添加响应中间件
   */
  useResponse(middleware) {
    this.responseMiddlewares.push(middleware);
    return this;
  }
  /**
   * 添加错误中间件
   */
  useError(middleware) {
    this.errorMiddlewares.push(middleware);
    return this;
  }
  /**
   * 移除中间件
   */
  removeMiddleware(name) {
    let removed = false;
    const removeFromArray = (arr) => {
      const index = arr.findIndex((m) => m.name === name);
      if (index > -1) {
        arr.splice(index, 1);
        removed = true;
      }
      return arr;
    };
    this.requestMiddlewares = removeFromArray(this.requestMiddlewares);
    this.responseMiddlewares = removeFromArray(this.responseMiddlewares);
    this.errorMiddlewares = removeFromArray(this.errorMiddlewares);
    return removed;
  }
  // ========================================================================
  // 统计与缓存 API
  // ========================================================================
  /**
   * 获取聚合统计
   */
  getStats() {
    return this.stats.getAggregateStats();
  }
  /**
   * 获取最近的调用记录
   */
  getRecentCalls(count = 10) {
    return this.stats.getRecentStats(count);
  }
  /**
   * 导出统计数据
   */
  exportStats() {
    return this.stats.export();
  }
  /**
   * 清空统计
   */
  clearStats() {
    this.stats.clear();
  }
  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
  }
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  // ========================================================================
  // Provider 访问
  // ========================================================================
  /**
   * 获取底层 Provider
   */
  getProvider() {
    return this.provider;
  }
  /**
   * 获取 Provider 名称
   */
  getProviderName() {
    return this.provider.getProviderName();
  }
  /**
   * 获取当前模型
   */
  getModel() {
    return this.provider.getModel();
  }
  // ========================================================================
  // 私有方法
  // ========================================================================
  /**
   * 执行请求（带重试）
   */
  async executeWithRetry(request, context, options) {
    const maxRetries = options.maxRetries ?? this.config.retry.maxRetries;
    const timeout = options.timeout ?? this.config.defaultTimeout;
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      context.retryCount = attempt;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), timeout);
        });
        const requestPromise = this.provider.chat(request);
        const response = await Promise.race([requestPromise, timeoutPromise]);
        return response;
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted) {
          throw new Error("Request aborted");
        }
        if (attempt < maxRetries && isRetryableError(lastError, this.config.retry.retryableErrors)) {
          const backoff = Math.min(
            this.config.retry.initialBackoff * Math.pow(this.config.retry.backoffMultiplier, attempt),
            this.config.retry.maxBackoff
          );
          await sleep2(backoff);
          continue;
        }
        throw lastError;
      }
    }
    throw lastError || new Error("Max retries exceeded");
  }
  /**
   * 检查速率限制
   */
  async checkRateLimit() {
    if (!this.config.rateLimit.enabled) return;
    const now = Date.now();
    if (now - this.rateLimitState.windowStart >= this.config.rateLimit.windowMs) {
      this.rateLimitState = { count: 0, windowStart: now };
    }
    if (this.rateLimitState.count >= this.config.rateLimit.maxRequests) {
      const waitTime = this.config.rateLimit.windowMs - (now - this.rateLimitState.windowStart);
      if (waitTime > 0) {
        await sleep2(waitTime);
        this.rateLimitState = { count: 0, windowStart: Date.now() };
      }
    }
    this.rateLimitState.count++;
  }
  /**
   * 创建结果对象
   */
  createResult(response, context, cached) {
    return {
      ...response,
      requestId: context.requestId,
      duration: Date.now() - context.startTime,
      cached,
      retryCount: context.retryCount
    };
  }
  /**
   * 记录统计
   */
  recordStats(context, result, success, error) {
    this.stats.record({
      requestId: context.requestId,
      providerName: context.providerName,
      model: context.model,
      startTime: context.startTime,
      endTime: Date.now(),
      duration: Date.now() - context.startTime,
      usage: result?.usage,
      success,
      cached: result?.cached ?? false,
      retryCount: context.retryCount,
      error
    });
  }
};
function createLLMService(provider, config = {}) {
  return new LLMService(provider, config);
}

// src/core/llm-service/middlewares.ts
function createRequestLoggingMiddleware(logger = console.log) {
  return {
    name: "request-logging",
    process(request, context) {
      logger(`[LLM] Request ${context.requestId}`, {
        provider: context.providerName,
        model: context.model,
        messageCount: request.messages.length
      });
      return request;
    }
  };
}
function createResponseLoggingMiddleware(logger = console.log) {
  return {
    name: "response-logging",
    process(response, context) {
      logger(`[LLM] Response ${context.requestId}`, {
        duration: Date.now() - context.startTime,
        contentLength: response.content.length,
        usage: response.usage
      });
      return response;
    }
  };
}
function createLoggingMiddleware(logger = console.log) {
  return {
    request: createRequestLoggingMiddleware(logger),
    response: createResponseLoggingMiddleware(logger)
  };
}
function createSystemPromptMiddleware(systemPrompt, options = {}) {
  const { prepend = true, override = false } = options;
  return {
    name: "system-prompt",
    process(request, _context) {
      const messages = [...request.messages];
      const existingSystemIndex = messages.findIndex((m) => m.role === "system");
      if (override || existingSystemIndex === -1) {
        const systemMessage = { role: "system", content: systemPrompt };
        if (existingSystemIndex > -1) {
          messages[existingSystemIndex] = systemMessage;
        } else if (prepend) {
          messages.unshift(systemMessage);
        } else {
          messages.push(systemMessage);
        }
      }
      return { ...request, messages };
    }
  };
}
function createContentFilterMiddleware(filterPatterns) {
  return {
    name: "content-filter",
    process(request, _context) {
      const messages = request.messages.map((msg) => {
        let content = msg.content;
        for (const { pattern, replacement } of filterPatterns) {
          content = content.replace(pattern, replacement);
        }
        return { ...msg, content };
      });
      return { ...request, messages };
    }
  };
}
function createTruncationMiddleware(maxMessages, options = {}) {
  const { keepSystemPrompt = true, keepLatestN = 2 } = options;
  return {
    name: "truncation",
    process(request, _context) {
      if (request.messages.length <= maxMessages) {
        return request;
      }
      let messages = request.messages;
      const systemMessage = keepSystemPrompt ? messages.find((m) => m.role === "system") : void 0;
      const nonSystemMessages = messages.filter((m) => m.role !== "system");
      const truncatedMessages = nonSystemMessages.slice(-keepLatestN);
      messages = systemMessage ? [systemMessage, ...truncatedMessages] : truncatedMessages;
      return { ...request, messages };
    }
  };
}
function createValidationMiddleware(validator, onInvalid) {
  return {
    name: "validation",
    process(response, _context) {
      if (!validator(response.content)) {
        if (onInvalid) {
          return { ...response, content: onInvalid(response.content) };
        }
        throw new Error("Response validation failed");
      }
      return response;
    }
  };
}
function createTransformMiddleware(transformer) {
  return {
    name: "transform",
    process(response, _context) {
      return { ...response, content: transformer(response.content) };
    }
  };
}
function createJsonParseMiddleware(options = {}) {
  const { strict = false, defaultValue = null } = options;
  return {
    name: "json-parse",
    process(response, _context) {
      try {
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonContent = jsonMatch ? jsonMatch[1] : response.content;
        const parsed = JSON.parse(jsonContent);
        return {
          ...response,
          content: JSON.stringify(parsed)
          // 规范化后的 JSON
        };
      } catch (error) {
        if (strict) {
          throw new Error(`Failed to parse JSON response: ${error}`);
        }
        return {
          ...response,
          content: JSON.stringify(defaultValue)
        };
      }
    }
  };
}
function createFallbackMiddleware(fallbackContent) {
  return {
    name: "fallback",
    process(error, context) {
      const content = typeof fallbackContent === "function" ? fallbackContent(error, context) : fallbackContent;
      return {
        content,
        finishReason: "stop"
      };
    }
  };
}
function createErrorLoggingMiddleware(logger = console.error) {
  return {
    name: "error-logging",
    process(error, context) {
      logger(`[LLM] Error in request ${context.requestId}`, error, context);
      return null;
    }
  };
}
function createErrorTransformMiddleware(transformer) {
  return {
    name: "error-transform",
    process(error, context) {
      throw transformer(error, context);
    }
  };
}
export {
  Agent,
  AgentAbortController,
  BaseNode,
  ConfirmationNode,
  DEFAULT_LLM_SERVICE_CONFIG,
  ErrorType,
  EventStream,
  GeminiProvider,
  GraphRunner,
  LLMCache,
  LLMIntentRouter,
  LLMPlannerNode,
  LLMProvider,
  LLMProviderError,
  LLMResponderNode,
  LLMService,
  LLMStatsCollector,
  LMStudioProvider,
  OpenAIProvider,
  PlannerNode,
  ResponderNode,
  RuleBasedIntentRouter,
  StateHelpers,
  ToolRegistry,
  ToolRunnerNode,
  VerifierNode,
  createAbortController,
  createAgent,
  createContentFilterMiddleware,
  createDebugBundle,
  createError,
  createErrorLoggingMiddleware,
  createErrorTransformMiddleware,
  createEventStreamAuditLogger,
  createFallbackMiddleware,
  createJsonParseMiddleware,
  createLLMProvider,
  createLLMService,
  createLoggingMiddleware,
  createProviderFromSettings,
  createRequestLoggingMiddleware,
  createResponseLoggingMiddleware,
  createState,
  createSystemPromptMiddleware,
  createTransformMiddleware,
  createTruncationMiddleware,
  createValidationMiddleware,
  deserializeState,
  documentSearchTool,
  downloadDebugBundle,
  exportDebugBundle,
  formatErrorMessage,
  getBackoffDelay,
  getErrorStrategy,
  getExampleTools,
  importDebugBundle,
  isAbortError,
  resolvePermissions,
  resolveRoles,
  retryWithBackoff,
  rollbackToCheckpoint,
  serializeState,
  sqlQueryTool,
  updateState,
  validateState
};
//# sourceMappingURL=agent-framework.js.map
