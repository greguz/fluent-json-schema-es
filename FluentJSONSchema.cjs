'use strict'

const deepmerge = require('@fastify/deepmerge')

const isFluentSchema = obj => obj && obj.isFluentSchema

const hasCombiningKeywords = attributes =>
  attributes.allOf || attributes.anyOf || attributes.oneOf || attributes.not

class FluentSchemaError extends Error {
  constructor (message) {
    super(message)
    this.name = 'FluentSchemaError'
  }
}

const last = array => {
  if (!array) return
  const [prop] = [...array].reverse()
  return prop
}

const isUniq = array => array.filter((v, i, a) => a.indexOf(v) === i).length === array.length

const isBoolean = value => typeof value === 'boolean'

const omit = (obj, props) =>
  Object.entries(obj).reduce((memo, [key, value]) => {
    if (props.includes(key)) return memo
    return {
      ...memo,
      [key]: value
    }
  }, {})

const flat = array =>
  array.reduce((memo, prop) => {
    const { name, ...rest } = prop
    return {
      ...memo,
      [name]: rest
    }
  }, {})

const combineArray = (options) => {
  const {
    clone,
    isMergeableObject,
    deepmerge
  } = options

  return (target, source) => {
    const result = target.slice()

    source.forEach((item, index) => {
      const prop = target.find(attr => attr.name === item.name)
      if (typeof result[index] === 'undefined') {
        result[index] = clone(item)
      } else if (isMergeableObject(prop)) {
        const propIndex = target.findIndex(prop => prop.name === item.name)
        result[propIndex] = deepmerge(prop, item)
      } else if (target.indexOf(item) === -1) {
        result.push(item)
      }
    })
    return result
  }
}

const combineDeepmerge = deepmerge({ mergeArray: combineArray })
const toArray = obj =>
  obj && Object.entries(obj).map(([key, value]) => ({ name: key, ...value }))

const REQUIRED = Symbol('required')
const FLUENT_SCHEMA = Symbol.for('fluent-schema-object')

const RELATIVE_JSON_POINTER = 'relative-json-pointer'
const JSON_POINTER = 'json-pointer'
const UUID = 'uuid'
const REGEX = 'regex'
const IPV6 = 'ipv6'
const IPV4 = 'ipv4'
const HOSTNAME = 'hostname'
const EMAIL = 'email'
const URL = 'url'
const URI_TEMPLATE = 'uri-template'
const URI_REFERENCE = 'uri-reference'
const URI = 'uri'
const TIME = 'time'
const DATE = 'date'
const DATE_TIME = 'date-time'

const FORMATS = {
  RELATIVE_JSON_POINTER,
  JSON_POINTER,
  UUID,
  REGEX,
  IPV6,
  IPV4,
  HOSTNAME,
  EMAIL,
  URL,
  URI_TEMPLATE,
  URI_REFERENCE,
  URI,
  TIME,
  DATE,
  DATE_TIME
}

const STRING = 'string'
const NUMBER = 'number'
const BOOLEAN = 'boolean'
const INTEGER = 'integer'
const OBJECT = 'object'
const ARRAY = 'array'
const NULL = 'null'

const TYPES = {
  STRING,
  NUMBER,
  BOOLEAN,
  INTEGER,
  OBJECT,
  ARRAY,
  NULL
}

const patchIdsWithParentId = ({ schema, generateIds, parentId }) => {
  const properties = Object.entries(schema.properties || {})
  if (properties.length === 0) return schema
  return {
    ...schema,
    properties: properties.reduce((memo, [key, props]) => {
      const $id = props.$id || (generateIds ? `#properties/${key}` : undefined)
      return {
        ...memo,
        [key]: {
          ...props,
          $id:
            generateIds && parentId
              ? `${parentId}/${$id.replace('#', '')}`
              : $id // e.g. #properties/foo/properties/bar
        }
      }
    }, {})
  }
}

const appendRequired = ({
  attributes: { name, required, ...attributes },
  schema
}) => {
  const { schemaRequired, attributeRequired } = (required || []).reduce(
    (memo, item) => {
      return item === REQUIRED
        ? {
            ...memo,
            // append prop name to the schema.required
            schemaRequired: [...memo.schemaRequired, name]
          }
        : {
            ...memo,
            // propagate required attributes
            attributeRequired: [...memo.attributeRequired, item]
          }
    },
    { schemaRequired: [], attributeRequired: [] }
  )

  const patchedRequired = [...schema.required, ...schemaRequired]
  if (!isUniq(patchedRequired)) {
    throw new FluentSchemaError("'required' has repeated keys, check your calls to .required()")
  }

  const schemaPatched = {
    ...schema,
    required: patchedRequired
  }
  const attributesPatched = {
    ...attributes,
    required: attributeRequired
  }
  return [schemaPatched, attributesPatched]
}

const setAttribute = ({ schema, ...options }, attribute) => {
  const [key, value] = attribute
  const currentProp = last(schema.properties)
  if (currentProp) {
    const { name, ...props } = currentProp
    return options.factory({ schema, ...options }).prop(name, {
      [key]: value,
      ...props
    })
  }
  return options.factory({ schema: { ...schema, [key]: value }, ...options })
}

const setRaw = ({ schema, ...options }, raw) => {
  const currentProp = last(schema.properties)
  if (currentProp) {
    const { name, ...props } = currentProp
    return options.factory({ schema, ...options }).prop(name, {
      ...raw,
      ...props
    })
  }
  return options.factory({ schema: { ...schema, ...raw }, ...options })
}
// TODO LS maybe we can just use setAttribute and remove this one
const setComposeType = ({ prop, schemas, schema, options }) => {
  if (!(Array.isArray(schemas) && schemas.every(v => isFluentSchema(v)))) {
    throw new FluentSchemaError(
      `'${prop}' must be a an array of FluentSchema rather than a '${typeof schemas}'`
    )
  }

  const values = schemas.map(schema => {
    const { $schema, ...props } = schema.valueOf({ isRoot: false })
    return props
  })

  return options.factory({ schema: { ...schema, [prop]: values }, ...options })
}

const initialState$9 = {
  properties: [],
  required: []
}

/**
 * Represents a BaseSchema.
 * @param {Object} [options] - Options
 * @param {BaseSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {BaseSchema}
 */

const BaseSchema = (
  { schema = initialState$9, ...options } = {
    generateIds: false,
    factory: BaseSchema
  }
) => ({
  [FLUENT_SCHEMA]: true,
  isFluentSchema: true,
  isFluentJSONSchema: true,

  /**
   * It defines a URI for the schema, and the base URI that other URI references within the schema are resolved against.
   *
   * {@link https://tools.ietf.org/html/draft-handrews-json-schema-01#section-8.2|reference}
   * @param {string} id - an #id
   * @returns {BaseSchema}
   */

  id: id => {
    if (!id) {
      throw new FluentSchemaError(
        'id should not be an empty fragment <#> or an empty string <> (e.g. #myId)'
      )
    }
    return setAttribute({ schema, ...options }, ['$id', id, 'any'])
  },

  /**
   * It can be used to decorate a user interface with information about the data produced by this user interface. A title will preferably be short.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.10.1|reference}
   * @param {string} title
   * @returns {BaseSchema}
   */

  title: title => {
    return setAttribute({ schema, ...options }, ['title', title, 'any'])
  },

  /**
   * It can be used to decorate a user interface with information about the data
   * produced by this user interface. A description provides explanation about
   * the purpose of the instance described by the schema.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.10.1|reference}
   * @param {string} description
   * @returns {BaseSchema}
   */
  description: description => {
    return setAttribute({ schema, ...options }, [
      'description',
      description,
      'any'
    ])
  },

  /**
   * The value of this keyword MUST be an array.
   * There are no restrictions placed on the values within the array.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.10.4|reference}
   * @param {string} examples
   * @returns {BaseSchema}
   */

  examples: examples => {
    if (!Array.isArray(examples)) {
      throw new FluentSchemaError(
        "'examples' must be an array e.g. ['1', 'one', 'foo']"
      )
    }
    return setAttribute({ schema, ...options }, ['examples', examples, 'any'])
  },

  /**
   * The value must be a valid id e.g. #properties/foo
   *
   * @param {string} ref
   * @returns {BaseSchema}
   */

  ref: ref => {
    return setAttribute({ schema, ...options }, ['$ref', ref, 'any'])
  },

  /**
   * The value of this keyword MUST be an array. This array SHOULD have at least one element. Elements in the array SHOULD be unique.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.1.2|reference}
   * @param {array} values
   * @returns {BaseSchema}
   */

  enum: values => {
    if (!Array.isArray(values)) {
      throw new FluentSchemaError(
        "'enums' must be an array with at least an element e.g. ['1', 'one', 'foo']"
      )
    }
    return setAttribute({ schema, ...options }, ['enum', values, 'any'])
  },

  /**
   * The value of this keyword MAY be of any type, including null.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.1.3|reference}
   * @param value
   * @returns {BaseSchema}
   */

  const: value => {
    return setAttribute({ schema, ...options }, ['const', value, 'any'])
  },

  /**
   * There are no restrictions placed on the value of this keyword.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.10.2|reference}
   * @param defaults
   * @returns {BaseSchema}
   */

  default: defaults => {
    return setAttribute({ schema, ...options }, ['default', defaults, 'any'])
  },

  /**
   * The value of readOnly can be left empty to indicate the property is readOnly.
   * It takes an optional boolean which can be used to explicitly set readOnly true/false.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.10.3|reference}
   * @param {boolean|undefined} isReadOnly
   * @returns {BaseSchema}
   */

  readOnly: isReadOnly => {
    const value = isReadOnly !== undefined ? isReadOnly : true
    return setAttribute({ schema, ...options }, ['readOnly', value, 'boolean'])
  },

  /**
   * The value of writeOnly can be left empty to indicate the property is writeOnly.
   * It takes an optional boolean which can be used to explicitly set writeOnly true/false.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.10.3|reference}
   * @param {boolean|undefined} isWriteOnly
   * @returns {BaseSchema}
   */

  writeOnly: isWriteOnly => {
    const value = isWriteOnly !== undefined ? isWriteOnly : true
    return setAttribute({ schema, ...options }, ['writeOnly', value, 'boolean'])
  },

  /**
   * The value of deprecated can be left empty to indicate the property is deprecated.
   * It takes an optional boolean which can be used to explicitly set deprecated true/false.
   *
   * {@link https://json-schema.org/draft/2019-09/json-schema-validation.html#rfc.section.9.3|reference}
   * @param {Boolean} isDeprecated
   * @returns {BaseSchema}
   */
  deprecated: (isDeprecated) => {
    if (isDeprecated && !isBoolean(isDeprecated)) throw new FluentSchemaError("'deprecated' must be a boolean value")
    const value = isDeprecated !== undefined ? isDeprecated : true
    return setAttribute({ schema, ...options }, ['deprecated', value, 'boolean'])
  },

  /**
   * Required has to be chained to a property:
   * Examples:
   * - S.prop('prop').required()
   * - S.prop('prop', S.number()).required()
   * - S.required(['foo', 'bar'])
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.3|reference}
   * @returns {FluentSchema}
   */
  required: props => {
    const currentProp = last(schema.properties)
    const required = Array.isArray(props)
      ? [...schema.required, ...props]
      : currentProp
        ? [...schema.required, currentProp.name]
        : [REQUIRED]

    if (!isUniq(required)) {
      throw new FluentSchemaError("'required' has repeated keys, check your calls to .required()")
    }

    return options.factory({
      schema: { ...schema, required },
      ...options
    })
  },

  /**
   * This keyword's value MUST be a valid JSON Schema.
   * An instance is valid against this keyword if it fails to validate successfully against the schema defined by this keyword.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.7.4|reference}
   * @param {FluentSchema} not
   * @returns {BaseSchema}
   */
  not: not => {
    if (!isFluentSchema(not)) { throw new FluentSchemaError("'not' must be a BaseSchema") }
    const notSchema = omit(not.valueOf(), ['$schema', 'definitions'])

    return BaseSchema({
      schema: {
        ...schema,
        not: patchIdsWithParentId({
          schema: notSchema,
          ...options,
          parentId: '#not'
        })
      },
      ...options
    })
  },
  // return setAttribute({ schema, ...options }, ['defaults', defaults, 'any'])

  /**
   * It MUST be a non-empty array. Each item of the array MUST be a valid JSON Schema.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.7.2|reference}
   * @param {array} schemas
   * @returns {BaseSchema}
   */

  anyOf: schemas => setComposeType({ prop: 'anyOf', schemas, schema, options }),

  /**
   * It MUST be a non-empty array. Each item of the array MUST be a valid JSON Schema.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.7.1|reference}
   * @param {array} schemas
   * @returns {BaseSchema}
   */

  allOf: schemas => setComposeType({ prop: 'allOf', schemas, schema, options }),

  /**
   * It MUST be a non-empty array. Each item of the array MUST be a valid JSON Schema.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.7.3|reference}
   * @param {array} schemas
   * @returns {BaseSchema}
   */

  oneOf: schemas => setComposeType({ prop: 'oneOf', schemas, schema, options }),

  /**
   * @private set a property to a type. Use string number etc.
   * @returns {BaseSchema}
   */
  as: type => setAttribute({ schema, ...options }, ['type', type]),

  /**
   * This validation outcome of this keyword's subschema has no direct effect on the overall validation result.
   * Rather, it controls which of the "then" or "else" keywords are evaluated.
   * When "if" is present, and the instance successfully validates against its subschema, then
   * validation succeeds against this keyword if the instance also successfully validates against this keyword's subschema.
   *
   * @param {BaseSchema} ifClause
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.6.1|reference}
   * @param {BaseSchema} thenClause
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.6.2|reference}
   * @returns {BaseSchema}
   */

  ifThen: (ifClause, thenClause) => {
    if (!isFluentSchema(ifClause)) { throw new FluentSchemaError("'ifClause' must be a BaseSchema") }
    if (!isFluentSchema(thenClause)) { throw new FluentSchemaError("'thenClause' must be a BaseSchema") }

    const ifClauseSchema = omit(ifClause.valueOf(), [
      '$schema',
      'definitions',
      'type'
    ])
    const thenClauseSchema = omit(thenClause.valueOf(), [
      '$schema',
      'definitions',
      'type'
    ])

    return options.factory({
      schema: {
        ...schema,
        if: patchIdsWithParentId({
          schema: ifClauseSchema,
          ...options,
          parentId: '#if'
        }),
        then: patchIdsWithParentId({
          schema: thenClauseSchema,
          ...options,
          parentId: '#then'
        })
      },
      ...options
    })
  },

  /**
   * When "if" is present, and the instance fails to validate against its subschema,
   * then validation succeeds against this keyword if the instance successfully validates against this keyword's subschema.
   *
   * @param {BaseSchema} ifClause
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.6.1|reference}
   * @param {BaseSchema} thenClause
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.6.2|reference}
   * @param {BaseSchema} elseClause
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.6.3|reference}
   * @returns {BaseSchema}
   */

  ifThenElse: (ifClause, thenClause, elseClause) => {
    if (!isFluentSchema(ifClause)) { throw new FluentSchemaError("'ifClause' must be a BaseSchema") }
    if (!isFluentSchema(thenClause)) { throw new FluentSchemaError("'thenClause' must be a BaseSchema") }
    if (!isFluentSchema(elseClause)) {
      throw new FluentSchemaError(
        "'elseClause' must be a BaseSchema or a false boolean value"
      )
    }
    const ifClauseSchema = omit(ifClause.valueOf(), [
      '$schema',
      'definitions',
      'type'
    ])
    const thenClauseSchema = omit(thenClause.valueOf(), [
      '$schema',
      'definitions',
      'type'
    ])
    const elseClauseSchema = omit(elseClause.valueOf(), [
      '$schema',
      'definitions',
      'type'
    ])

    return options.factory({
      schema: {
        ...schema,
        if: patchIdsWithParentId({
          schema: ifClauseSchema,
          ...options,
          parentId: '#if'
        }),
        then: patchIdsWithParentId({
          schema: thenClauseSchema,
          ...options,
          parentId: '#then'
        }),
        else: patchIdsWithParentId({
          schema: elseClauseSchema,
          ...options,
          parentId: '#else'
        })
      },
      ...options
    })
  },

  /**
   * Because the differences between JSON Schemas and Open API (Swagger)
   * it can be handy to arbitrary modify the schema injecting a fragment
   *
   * * Examples:
   * - S.number().raw({ nullable:true })
   * - S.string().format('date').raw({ formatMaximum: '2020-01-01' })
   *
   * @param {string} fragment an arbitrary JSON Schema to inject
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3.3|reference}
   * @returns {BaseSchema}
   */
  raw: fragment => {
    return setRaw({ schema, ...options }, fragment)
  },

  /**
   * @private It returns the internal schema data structure
   * @returns {object}
   */
  // TODO LS if we implement S.raw() we can drop this hack because from a JSON we can rebuild a fluent-json-schema
  _getState: () => {
    return schema
  },

  /**
   * It returns all the schema values
   *
   * @param {Object} [options] - Options
   * @param {boolean} [options.isRoot = true] - Is a root level schema
   * @returns {object}
   */
  valueOf: ({ isRoot } = { isRoot: true }) => {
    const { properties, definitions, required, $schema, ...rest } = schema

    if (isRoot && required && !required.every((v) => typeof v === 'string')) {
      throw new FluentSchemaError("'required' has called on root-level schema, check your calls to .required()")
    }

    return Object.assign(
      $schema ? { $schema } : {},
      Object.keys(definitions || []).length > 0
        ? { definitions: flat(definitions) }
        : undefined,
      { ...omit(rest, ['if', 'then', 'else']) },
      Object.keys(properties || []).length > 0
        ? { properties: flat(properties) }
        : undefined,
      required && required.length > 0 ? { required } : undefined,
      schema.if ? { if: schema.if } : undefined,
      schema.then ? { then: schema.then } : undefined,
      schema.else ? { else: schema.else } : undefined
    )
  }
})

const initialState$8 = {
  type: 'null'
}

/**
 * Represents a NullSchema.
 * @param {Object} [options] - Options
 * @param {StringSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */

const NullSchema = ({ schema = initialState$8, ...options } = {}) => {
  options = {
    generateIds: false,
    factory: NullSchema,
    ...options
  }
  const { valueOf, raw } = BaseSchema({ ...options, schema })
  return {
    valueOf,
    raw,
    [FLUENT_SCHEMA]: true,
    isFluentSchema: true,

    /**
     * Set a property to type null
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.1.1|reference}
     * @returns {FluentSchema}
     */
    null: () => setAttribute({ schema, ...options }, ['type', 'null'])
  }
}

const initialState$7 = {
  type: 'boolean'
}

/**
 * Represents a BooleanSchema.
 * @param {Object} [options] - Options
 * @param {StringSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */

const BooleanSchema = ({ schema = initialState$7, ...options } = {}) => {
  options = {
    generateIds: false,
    factory: BaseSchema,
    ...options
  }
  return {
    ...BaseSchema({ ...options, schema })
  }
}

const initialState$6 = {
  type: 'string',
  // properties: [], //FIXME it shouldn't be set for a string because it has only attributes
  required: []
}

/**
 * Represents a StringSchema.
 * @param {Object} [options] - Options
 * @param {StringSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */
// https://medium.com/javascript-scene/javascript-factory-functions-with-es6-4d224591a8b1
// Factory Functions for Mixin Composition withBaseSchema
const StringSchema = (
  { schema, ...options } = {
    schema: initialState$6,
    generateIds: false,
    factory: StringSchema
  }
) => ({
  ...BaseSchema({ ...options, schema }),
  /* /!**
   * Set a property to type string
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3|reference}
   * @returns {StringSchema}
   *!/

  string: () =>
    StringSchema({ schema: { ...schema }, ...options }).as('string'), */

  /**
   * A string instance is valid against this keyword if its length is greater than, or equal to, the value of this keyword.
   * The length of a string instance is defined as the number of its characters as defined by RFC 7159 [RFC7159].
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3.2|reference}
   * @param {number} min
   * @returns {StringSchema}
   */

  minLength: min => {
    if (!Number.isInteger(min)) { throw new FluentSchemaError("'minLength' must be an Integer") }
    return setAttribute({ schema, ...options }, ['minLength', min, 'string'])
  },

  /**
   * A string instance is valid against this keyword if its length is less than, or equal to, the value of this keyword.
   * The length of a string instance is defined as the number of its characters as defined by RFC 7159 [RFC7159].
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3.1|reference}
   * @param {number} max
   * @returns {StringSchema}
   */

  maxLength: max => {
    if (!Number.isInteger(max)) { throw new FluentSchemaError("'maxLength' must be an Integer") }
    return setAttribute({ schema, ...options }, ['maxLength', max, 'string'])
  },

  /**
   * A string value can be RELATIVE_JSON_POINTER, JSON_POINTER, UUID, REGEX, IPV6, IPV4, HOSTNAME, EMAIL, URL, URI_TEMPLATE, URI_REFERENCE, URI, TIME, DATE,
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.7.3|reference}
   * @param {string} format
   * @returns {StringSchema}
   */

  format: format => {
    if (!Object.values(FORMATS).includes(format)) {
      throw new FluentSchemaError(
        `'format' must be one of ${Object.values(FORMATS).join(', ')}`
      )
    }
    return setAttribute({ schema, ...options }, ['format', format, 'string'])
  },

  /**
   *  This string SHOULD be a valid regular expression, according to the ECMA 262 regular expression dialect.
   *  A string instance is considered valid if the regular expression matches the instance successfully.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3.3|reference}
   * @param {string} pattern
   * @returns {StringSchema}
   */
  pattern: pattern => {
    if (!(typeof pattern === 'string') && !(pattern instanceof RegExp)) {
      throw new FluentSchemaError(
        '\'pattern\' must be a string or a RegEx (e.g. /.*/)'
      )
    }

    if (pattern instanceof RegExp) {
      const flags = new RegExp(pattern).flags
      pattern = pattern
        .toString()
        .substr(1)
        .replace(new RegExp(`/${flags}$`), '')
    }

    return setAttribute({ schema, ...options }, ['pattern', pattern, 'string'])
  },

  /**
   *  If the instance value is a string, this property defines that the string SHOULD
   *  be interpreted as binary data and decoded using the encoding named by this property.
   *  RFC 2045, Sec 6.1 [RFC2045] lists the possible values for this property.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.8.3|reference}
   * @param {string} encoding
   * @returns {StringSchema}
   */

  contentEncoding: encoding => {
    if (!(typeof encoding === 'string')) { throw new FluentSchemaError('\'contentEncoding\' must be a string') }
    return setAttribute({ schema, ...options }, [
      'contentEncoding',
      encoding,
      'string'
    ])
  },

  /**
   *  The value of this property must be a media type, as defined by RFC 2046 [RFC2046].
   *  This property defines the media type of instances which this schema defines.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.8.4|reference}
   * @param {string} mediaType
   * @returns {StringSchema}
   */

  contentMediaType: mediaType => {
    if (!(typeof mediaType === 'string')) { throw new FluentSchemaError('\'contentMediaType\' must be a string') }
    return setAttribute({ schema, ...options }, [
      'contentMediaType',
      mediaType,
      'string'
    ])
  }
})

const initialState$5 = {
  type: 'number'
}

/**
 * Represents a NumberSchema.
 * @param {Object} [options] - Options
 * @param {NumberSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {NumberSchema}
 */
// https://medium.com/javascript-scene/javascript-factory-functions-with-es6-4d224591a8b1
// Factory Functions for Mixin Composition withBaseSchema
const NumberSchema = (
  { schema, ...options } = {
    schema: initialState$5,
    generateIds: false,
    factory: NumberSchema
  }
) => ({
  ...BaseSchema({ ...options, schema }),

  /**
   * It represents  an inclusive lower limit for a numeric instance.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.2.4|reference}
   * @param {number} min
   * @returns {FluentSchema}
   */

  minimum: min => {
    if (typeof min !== 'number') { throw new FluentSchemaError("'minimum' must be a Number") }
    if (schema.type === 'integer' && !Number.isInteger(min)) { throw new FluentSchemaError("'minimum' must be an Integer") }
    return setAttribute({ schema, ...options }, ['minimum', min, 'number'])
  },

  /**
   * It represents an exclusive lower limit for a numeric instance.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.2.5|reference}
   * @param {number} min
   * @returns {FluentSchema}
   */

  exclusiveMinimum: min => {
    if (typeof min !== 'number') { throw new FluentSchemaError("'exclusiveMinimum' must be a Number") }
    if (schema.type === 'integer' && !Number.isInteger(min)) { throw new FluentSchemaError("'exclusiveMinimum' must be an Integer") }
    return setAttribute({ schema, ...options }, [
      'exclusiveMinimum',
      min,
      'number'
    ])
  },

  /**
   * It represents  an inclusive upper limit for a numeric instance.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.2.2|reference}
   * @param {number} max
   * @returns {FluentSchema}
   */

  maximum: max => {
    if (typeof max !== 'number') { throw new FluentSchemaError("'maximum' must be a Number") }
    if (schema.type === 'integer' && !Number.isInteger(max)) { throw new FluentSchemaError("'maximum' must be an Integer") }
    return setAttribute({ schema, ...options }, ['maximum', max, 'number'])
  },

  /**
   * It represents an exclusive upper limit for a numeric instance.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.2.3|reference}
   * @param {number} max
   * @returns {FluentSchema}
   */

  exclusiveMaximum: max => {
    if (typeof max !== 'number') { throw new FluentSchemaError("'exclusiveMaximum' must be a Number") }
    if (schema.type === 'integer' && !Number.isInteger(max)) { throw new FluentSchemaError("'exclusiveMaximum' must be an Integer") }
    return setAttribute({ schema, ...options }, [
      'exclusiveMaximum',
      max,
      'number'
    ])
  },

  /**
   * It's strictly greater than 0.
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.2.1|reference}
   * @param {number} multiple
   * @returns {FluentSchema}
   */

  multipleOf: multiple => {
    if (typeof multiple !== 'number') { throw new FluentSchemaError("'multipleOf' must be a Number") }
    if (schema.type === 'integer' && !Number.isInteger(multiple)) { throw new FluentSchemaError("'multipleOf' must be an Integer") }
    return setAttribute({ schema, ...options }, [
      'multipleOf',
      multiple,
      'number'
    ])
  }
})

const initialState$4 = {
  type: 'integer'
}

/**
 * Represents a NumberSchema.
 * @param {Object} [options] - Options
 * @param {NumberSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {NumberSchema}
 */
// https://medium.com/javascript-scene/javascript-factory-functions-with-es6-4d224591a8b1
// Factory Functions for Mixin Composition withBaseSchema
const IntegerSchema = (
  { schema, ...options } = {
    schema: initialState$4,
    generateIds: false,
    factory: IntegerSchema
  }
) => ({
  ...NumberSchema({ ...options, schema })
})

const initialState$3 = {
  type: 'object',
  definitions: [],
  properties: [],
  required: []
}

/**
 * Represents a ObjectSchema.
 * @param {Object} [options] - Options
 * @param {StringSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */

const ObjectSchema = ({ schema = initialState$3, ...options } = {}) => {
  // TODO LS think about default values and how pass all of them through the functions
  options = {
    generateIds: false,
    factory: ObjectSchema,
    ...options
  }
  return {
    ...BaseSchema({ ...options, schema }),

    /**
     * It defines a URI for the schema, and the base URI that other URI references within the schema are resolved against.
     * Calling `id`  on an ObjectSchema will alway set the id on the root of the object rather than in its "properties", which
     * differs from other schema types.
     *
     * {@link https://tools.ietf.org/html/draft-handrews-json-schema-01#section-8.2|reference}
     * @param {string} id - an #id
     **/
    id: id => {
      if (!id) {
        throw new FluentSchemaError(
          'id should not be an empty fragment <#> or an empty string <> (e.g. #myId)'
        )
      }
      return options.factory({ schema: { ...schema, $id: id }, ...options })
    },
    /**
     * This keyword determines how child instances validate for objects, and does not directly validate the immediate instance itself.
     * Validation with "additionalProperties" applies only to the child values of instance names that do not match any names in "properties",
     * and do not match any regular expression in "patternProperties".
     * For all such properties, validation succeeds if the child instance validates against the "additionalProperties" schema.
     * Omitting this keyword has the same behavior as an empty schema.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.6|reference}
     * @param {FluentSchema|boolean} value
     * @returns {FluentSchema}
     */

    additionalProperties: value => {
      if (typeof value === 'boolean') {
        return setAttribute({ schema, ...options }, [
          'additionalProperties',
          value,
          'object'
        ])
      }
      if (isFluentSchema(value)) {
        const { $schema, ...rest } = value.valueOf({ isRoot: false })
        return setAttribute({ schema, ...options }, [
          'additionalProperties',
          { ...rest },
          'array'
        ])
      }

      throw new FluentSchemaError(
        "'additionalProperties' must be a boolean or a S"
      )
    },

    /**
     * An object instance is valid against "maxProperties" if its number of properties is less than, or equal to, the value of this keyword.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.1|reference}
     * @param {number} max
     * @returns {FluentSchema}
     */

    maxProperties: max => {
      if (!Number.isInteger(max)) { throw new FluentSchemaError("'maxProperties' must be a Integer") }
      return setAttribute({ schema, ...options }, [
        'maxProperties',
        max,
        'object'
      ])
    },

    /**
     * An object instance is valid against "minProperties" if its number of properties is greater than, or equal to, the value of this keyword.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.2|reference}
     * @param {number} min
     * @returns {FluentSchema}
     */

    minProperties: min => {
      if (!Number.isInteger(min)) { throw new FluentSchemaError("'minProperties' must be a Integer") }
      return setAttribute({ schema, ...options }, [
        'minProperties',
        min,
        'object'
      ])
    },

    /**
     * Each property name of this object SHOULD be a valid regular expression, according to the ECMA 262 regular expression dialect.
     * Each property value of this object MUST be a valid JSON Schema.
     * This keyword determines how child instances validate for objects, and does not directly validate the immediate instance itself.
     * Validation of the primitive instance type against this keyword always succeeds.
     * Validation succeeds if, for each instance name that matches any regular expressions that appear as a property name in this keyword's value, the child instance for that name successfully validates against each schema that corresponds to a matching regular expression.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.5|reference}
     * @param {object} opts
     * @returns {FluentSchema}
     */

    patternProperties: opts => {
      const values = Object.entries(opts).reduce((memo, [pattern, schema]) => {
        if (!isFluentSchema(schema)) {
          throw new FluentSchemaError(
            "'patternProperties' invalid options. Provide a valid map e.g. { '^fo.*$': S.string() }"
          )
        }
        return {
          ...memo,
          [pattern]: omit(schema.valueOf({ isRoot: false }), ['$schema'])
        }
      }, {})
      return setAttribute({ schema, ...options }, [
        'patternProperties',
        values,
        'object'
      ])
    },

    /**
     * This keyword specifies rules that are evaluated if the instance is an object and contains a certain property.
     * This keyword's value MUST be an object. Each property specifies a dependency. Each dependency value MUST be an array or a valid JSON Schema.
     * If the dependency value is a subschema, and the dependency key is a property in the instance, the entire instance must validate against the dependency value.
     * If the dependency value is an array, each element in the array, if any, MUST be a string, and MUST be unique. If the dependency key is a property in the instance, each of the items in the dependency value must be a property that exists in the instance.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.7|reference}
     * @param {object} opts
     * @returns {FluentSchema}
     */

    dependencies: opts => {
      const values = Object.entries(opts).reduce((memo, [prop, schema]) => {
        if (!isFluentSchema(schema) && !Array.isArray(schema)) {
          throw new FluentSchemaError(
            "'dependencies' invalid options. Provide a valid map e.g. { 'foo': ['bar'] } or { 'foo': S.string() }"
          )
        }
        return {
          ...memo,
          [prop]: Array.isArray(schema)
            ? schema
            : omit(schema.valueOf({ isRoot: false }), ['$schema', 'type', 'definitions'])
        }
      }, {})
      return setAttribute({ schema, ...options }, [
        'dependencies',
        values,
        'object'
      ])
    },

    /**
     * The value of "properties" MUST be an object. Each dependency value MUST be an array.
     * Each element in the array MUST be a string and MUST be unique. If the dependency key is a property in the instance, each of the items in the dependency value must be a property that exists in the instance.
     *
     * {@link https://json-schema.org/draft/2019-09/json-schema-validation.html#rfc.section.6.5.4|reference}
     * @param {object} opts
     * @returns {FluentSchema}
     */

    dependentRequired: opts => {
      const values = Object.entries(opts).reduce((memo, [prop, schema]) => {
        if (!Array.isArray(schema)) {
          throw new FluentSchemaError(
            "'dependentRequired' invalid options. Provide a valid array e.g. { 'foo': ['bar'] }"
          )
        }
        return {
          ...memo,
          [prop]: schema
        }
      }, {})

      return setAttribute({ schema, ...options }, [
        'dependentRequired',
        values,
        'object'
      ])
    },

    /**
     * The value of "properties" MUST be an object. The dependency value MUST be a valid JSON Schema.
     * Each dependency key is a property in the instance and the entire instance must validate against the dependency value.
     *
     * {@link https://json-schema.org/draft/2019-09/json-schema-core.html#rfc.section.9.2.2.4|reference}
     * @param {object} opts
     * @returns {FluentSchema}
     */
    dependentSchemas: opts => {
      const values = Object.entries(opts).reduce((memo, [prop, schema]) => {
        if (!isFluentSchema(schema)) {
          throw new FluentSchemaError(
            "'dependentSchemas' invalid options. Provide a valid schema e.g. { 'foo': S.string() }"
          )
        }

        return {
          ...memo,
          [prop]: omit(schema.valueOf({ isRoot: false }), ['$schema', 'type', 'definitions'])
        }
      }, {})

      return setAttribute({ schema, ...options }, [
        'dependentSchemas',
        values,
        'object'
      ])
    },

    /**
     * If the instance is an object, this keyword validates if every property name in the instance validates against the provided schema.
     * Note the property name that the schema is testing will always be a string.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.8|reference}
     * @param {FluentSchema} value
     * @returns {FluentSchema}
     */

    propertyNames: value => {
      if (!isFluentSchema(value)) { throw new FluentSchemaError("'propertyNames' must be a S") }
      return setAttribute({ schema, ...options }, [
        'propertyNames',
        omit(value.valueOf({ isRoot: false }), ['$schema']),
        'object'
      ])
    },

    /**
     * The value of "properties" MUST be an object. Each value of this object MUST be a valid JSON Schema.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5.4|reference}
     * @param {string} name
     * @param {FluentSchema} props
     * @returns {FluentSchema}
     */

    prop: (name, props = {}) => {
      if (Array.isArray(props) || typeof props !== 'object') {
        throw new FluentSchemaError(
          `'${name}' doesn't support value '${JSON.stringify(
            props
          )}'. Pass a FluentSchema object`
        )
      }
      const target = props.def ? 'definitions' : 'properties'
      let attributes = props.valueOf({ isRoot: false })
      const $id =
        attributes.$id ||
        (options.generateIds ? `#${target}/${name}` : undefined)
      if (isFluentSchema(props)) {
        attributes = patchIdsWithParentId({
          schema: attributes,
          parentId: $id,
          ...options
        })

        const [schemaPatched, attributesPatched] = appendRequired({
          schema,
          attributes: {
            ...attributes,
            name
          }
        })

        schema = schemaPatched
        attributes = attributesPatched
      }

      const type = hasCombiningKeywords(attributes)
        ? undefined
        : attributes.type

      const $ref = attributes.$ref

      // strip undefined values or empty arrays or internals
      attributes = Object.entries({ ...attributes, $id, type }).reduce(
        (memo, [key, value]) => {
          return key === '$schema' ||
            key === 'def' ||
            value === undefined ||
            (Array.isArray(value) && value.length === 0 && key !== 'default')
            ? memo
            : { ...memo, [key]: value }
        },
        {}
      )

      return ObjectSchema({
        schema: {
          ...schema,
          [target]: [
            ...schema[target],
            $ref ? { name, $ref } : Object.assign({}, { name }, attributes)
          ]
        },
        ...options
      })
    },

    extend: base => {
      if (!base) {
        throw new FluentSchemaError("Schema can't be null or undefined")
      }
      if (!base.isFluentSchema) {
        throw new FluentSchemaError("Schema isn't FluentSchema type")
      }
      const src = base._getState()
      const extended = combineDeepmerge(src, schema)
      const {
        valueOf,
        isFluentSchema,
        FLUENT_SCHEMA,
        _getState,
        extend
      } = ObjectSchema({ schema: extended, ...options })
      return { valueOf, isFluentSchema, FLUENT_SCHEMA, _getState, extend }
    },

    /**
     * Returns an object schema with only a subset of keys provided. If called on an ObjectSchema with an
     * `$id`, it will be removed and the return value will be considered a new schema.
     *
     * @param properties a list of properties you want to keep
     * @returns {ObjectSchema}
     */
    only: properties => {
      return ObjectSchema({
        schema: {
          ...omit(schema, ['$id', 'properties']),
          properties: schema.properties.filter(({ name }) => properties.includes(name)),
          required: schema.required.filter(p => properties.includes(p))
        },
        ...options
      })
    },

    /**
     * Returns an object schema without a subset of keys provided. If called on an ObjectSchema with an
     * `$id`, it will be removed and the return value will be considered a new schema.
     *
     * @param properties a list of properties you dont want to keep
     * @returns {ObjectSchema}
     */
    without: properties => {
      return ObjectSchema({
        schema: {
          ...omit(schema, ['$id', 'properties']),
          properties: schema.properties.filter(({ name }) => !properties.includes(name)),
          required: schema.required.filter(p => !properties.includes(p))
        },
        ...options
      })
    },

    /**
     * The "definitions" keywords provides a standardized location for schema authors to inline re-usable JSON Schemas into a more general schema.
     * There are no restrictions placed on the values within the array.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.9|reference}
     * @param {string} name
     * @param {FluentSchema} props
     * @returns {FluentSchema}
     */
    // FIXME LS move to BaseSchema and remove .prop
    // TODO LS Is a definition a proper schema?
    definition: (name, props = {}) =>
      ObjectSchema({ schema, ...options }).prop(name, {
        ...props.valueOf({ isRoot: false }),
        def: true
      })
  }
}

const initialState$2 = {
  // $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'array',
  definitions: [],
  properties: [],
  required: []
}

/**
 * Represents a ArraySchema.
 * @param {Object} [options] - Options
 * @param {StringSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {ArraySchema}
 */
// https://medium.com/javascript-scene/javascript-factory-functions-with-es6-4d224591a8b1
// Factory Functions for Mixin Composition withBaseSchema
const ArraySchema = ({ schema = initialState$2, ...options } = {}) => {
  options = {
    generateIds: false,
    factory: ArraySchema,
    ...options
  }
  return {
    ...BaseSchema({ ...options, schema }),

    /**
     * This keyword determines how child instances validate for arrays, and does not directly validate the immediate instance itself.
     * If "items" is a schema, validation succeeds if all elements in the array successfully validate against that schema.
     * If "items" is an array of schemas, validation succeeds if each element of the instance validates against the schema at the same position, if any.
     * Omitting this keyword has the same behavior as an empty schema.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4.1|reference}
     * @param {FluentSchema|FluentSchema[]} items
     * @returns {FluentSchema}
     */

    items: items => {
      if (
        !isFluentSchema(items) &&
        !(
          Array.isArray(items) &&
          items.filter(v => isFluentSchema(v)).length > 0
        )
      ) { throw new FluentSchemaError("'items' must be a S or an array of S") }
      if (Array.isArray(items)) {
        const values = items.map(v => {
          const { $schema, ...rest } = v.valueOf()
          return rest
        })
        return setAttribute({ schema, ...options }, ['items', values, 'array'])
      }
      const { $schema, ...rest } = items.valueOf()
      return setAttribute({ schema, ...options }, [
        'items',
        { ...rest },
        'array'
      ])
    },

    /**
     * This keyword determines how child instances validate for arrays, and does not directly validate the immediate instance itself.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4.2|reference}
     * @param {FluentSchema|boolean} items
     * @returns {FluentSchema}
     */

    additionalItems: items => {
      if (typeof items !== 'boolean' && !isFluentSchema(items)) {
        throw new FluentSchemaError(
          "'additionalItems' must be a boolean or a S"
        )
      }
      if (items === false) {
        return setAttribute({ schema, ...options }, [
          'additionalItems',
          false,
          'array'
        ])
      }
      const { $schema, ...rest } = items.valueOf()
      return setAttribute({ schema, ...options }, [
        'additionalItems',
        { ...rest },
        'array'
      ])
    },

    /**
     * An array instance is valid against "contains" if at least one of its elements is valid against the given schema.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4.6|reference}
     * @param {FluentSchema} value
     * @returns {FluentSchema}
     */

    contains: value => {
      if (!isFluentSchema(value)) { throw new FluentSchemaError("'contains' must be a S") }
      const {
        $schema,
        definitions,
        properties,
        required,
        ...rest
      } = value.valueOf()
      return setAttribute({ schema, ...options }, [
        'contains',
        { ...rest },
        'array'
      ])
    },

    /**
     * If this keyword has boolean value false, the instance validates successfully.
     * If it has boolean value true, the instance validates successfully if all of its elements are unique.
     * Omitting this keyword has the same behavior as a value of false.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4.5|reference}
     * @param {boolean} boolean
     * @returns {FluentSchema}
     */

    uniqueItems: boolean => {
      if (typeof boolean !== 'boolean') { throw new FluentSchemaError("'uniqueItems' must be a boolean") }
      return setAttribute({ schema, ...options }, [
        'uniqueItems',
        boolean,
        'array'
      ])
    },

    /**
     * An array instance is valid against "minItems" if its size is greater than, or equal to, the value of this keyword.
     * Omitting this keyword has the same behavior as a value of 0.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4.4|reference}
     * @param {number} min
     * @returns {FluentSchema}
     */

    minItems: min => {
      if (!Number.isInteger(min)) { throw new FluentSchemaError("'minItems' must be a integer") }
      return setAttribute({ schema, ...options }, ['minItems', min, 'array'])
    },

    /**
     * An array instance is valid against "minItems" if its size is greater than, or equal to, the value of this keyword.
     * Omitting this keyword has the same behavior as a value of 0.
     *
     * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4.3|reference}
     * @param {number} max
     * @returns {FluentSchema}
     */

    maxItems: max => {
      if (!Number.isInteger(max)) { throw new FluentSchemaError("'maxItems' must be a integer") }
      return setAttribute({ schema, ...options }, ['maxItems', max, 'array'])
    }
  }
}

const initialState$1 = {
  type: [],
  definitions: [],
  properties: [],
  required: []
}

/**
 * Represents a MixedSchema.
 * @param {Object} [options] - Options
 * @param {MixedSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */

const MixedSchema = ({ schema = initialState$1, ...options } = {}) => {
  options = {
    generateIds: false,
    factory: MixedSchema,
    ...options
  }
  return {
    [FLUENT_SCHEMA]: true,
    ...(schema.type.includes(TYPES.STRING)
      ? StringSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.NUMBER)
      ? NumberSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.BOOLEAN)
      ? BooleanSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.INTEGER)
      ? IntegerSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.OBJECT)
      ? ObjectSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.ARRAY)
      ? ArraySchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.NULL)
      ? NullSchema({ ...options, schema, factory: MixedSchema })
      : {})
  }
}

/**
 * Represents a raw JSON Schema that will be parsed
 * @param {Object} schema
 * @returns {FluentSchema}
 */

const RawSchema = (schema = {}) => {
  if (typeof schema !== 'object') {
    throw new FluentSchemaError('A fragment must be a JSON object')
  }
  const { type, definitions, properties, required, ...props } = schema
  switch (schema.type) {
    case 'string': {
      const schema = {
        type,
        ...props
      }
      return StringSchema({ schema, factory: StringSchema })
    }

    case 'integer': {
      const schema = {
        type,
        ...props
      }
      return IntegerSchema({ schema, factory: NumberSchema })
    }
    case 'number': {
      const schema = {
        type,
        ...props
      }
      return NumberSchema({ schema, factory: NumberSchema })
    }

    case 'boolean': {
      const schema = {
        type,
        ...props
      }
      return BooleanSchema({ schema, factory: BooleanSchema })
    }

    case 'object': {
      const schema = {
        type,
        definitions: toArray(definitions) || [],
        properties: toArray(properties) || [],
        required: required || [],
        ...props
      }
      return ObjectSchema({ schema, factory: ObjectSchema })
    }

    case 'array': {
      const schema = {
        type,
        ...props
      }
      return ArraySchema({ schema, factory: ArraySchema })
    }

    default: {
      const schema = {
        ...props
      }

      return BaseSchema({
        schema,
        factory: BaseSchema
      })
    }
  }
}

const initialState = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: [],
  properties: [],
  required: []
}

/**
 * Represents a S.
 * @param {Object} [options] - Options
 * @param {S} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {S}
 */

const S = (
  { schema = initialState, ...options } = {
    generateIds: false,
    factory: BaseSchema
  }
) => ({
  ...BaseSchema({ ...options, schema }),

  /**
   * Set a property to type string
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3|reference}
   * @returns {StringSchema}
   */

  string: () =>
    StringSchema({
      ...options,
      schema,
      factory: StringSchema
    }).as('string'),

  /**
   * Set a property to type number
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#numeric|reference}
   * @returns {NumberSchema}
   */

  number: () =>
    NumberSchema({
      ...options,
      schema,
      factory: NumberSchema
    }).as('number'),

  /**
   * Set a property to type integer
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#numeric|reference}
   * @returns {IntegerSchema}
   */

  integer: () =>
    IntegerSchema({
      ...options,
      schema,
      factory: IntegerSchema
    }).as('integer'),

  /**
   * Set a property to type boolean
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.7|reference}
   * @returns {BooleanSchema}
   */

  boolean: () =>
    BooleanSchema({
      ...options,
      schema,
      factory: BooleanSchema
    }).as('boolean'),

  /**
   * Set a property to type array
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4|reference}
   * @returns {ArraySchema}
   */

  array: () =>
    ArraySchema({
      ...options,
      schema,
      factory: ArraySchema
    }).as('array'),

  /**
   * Set a property to type object
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5|reference}
   * @returns {ObjectSchema}
   */

  object: baseSchema =>
    ObjectSchema({
      ...options,
      schema: baseSchema || schema,
      factory: ObjectSchema
    }).as('object'),

  /**
   * Set a property to type null
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#general|reference}
   * @returns {NullSchema}
   */

  null: () =>
    NullSchema({
      ...options,
      schema,
      factory: NullSchema
    }).null(),

  /**
   * A mixed schema is the union of multiple types (e.g. ['string', 'integer']
   *
   * @param {Array.<string>} types
   * @returns {MixedSchema}
   */

  mixed: types => {
    if (
      !Array.isArray(types) ||
      (Array.isArray(types) &&
        types.filter(t => !Object.values(TYPES).includes(t)).length > 0)
    ) {
      throw new FluentSchemaError(
        `Invalid 'types'. It must be an array of types. Valid types are ${Object.values(
          TYPES
        ).join(' | ')}`
      )
    }

    return MixedSchema({
      ...options,
      schema: {
        ...schema,
        type: types
      },
      factory: MixedSchema
    })
  },

  /**
   * Because the differences between JSON Schemas and Open API (Swagger)
   * it can be handy to arbitrary modify the schema injecting a fragment
   *
   * * Examples:
   * - S.raw({ nullable:true, format: 'date', formatMaximum: '2020-01-01' })
   * - S.string().format('date').raw({ formatMaximum: '2020-01-01' })
   *
   * @param {string} fragment an arbitrary JSON Schema to inject
   * @returns {BaseSchema}
   */

  raw: fragment => {
    return RawSchema(fragment)
  }
})

const FluentJSONSchema = {
  ...BaseSchema(),
  FORMATS,
  TYPES,
  FluentSchemaError,
  withOptions: S,
  string: () => S().string(),
  mixed: types => S().mixed(types),
  object: () => S().object(),
  array: () => S().array(),
  boolean: () => S().boolean(),
  integer: () => S().integer(),
  number: () => S().number(),
  null: () => S().null(),
  raw: fragment => S().raw(fragment)
}

module.exports = FluentJSONSchema
