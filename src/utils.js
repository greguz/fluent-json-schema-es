import deepmerge from '@fastify/deepmerge'

export const isFluentSchema = obj => obj && obj.isFluentSchema

export const hasCombiningKeywords = attributes =>
  attributes.allOf || attributes.anyOf || attributes.oneOf || attributes.not

export class FluentSchemaError extends Error {
  constructor (message) {
    super(message)
    this.name = 'FluentSchemaError'
  }
}

export const last = array => {
  if (!array) return
  const [prop] = [...array].reverse()
  return prop
}

export const isUniq = array => array.filter((v, i, a) => a.indexOf(v) === i).length === array.length

export const isBoolean = value => typeof value === 'boolean'

export const omit = (obj, props) =>
  Object.entries(obj).reduce((memo, [key, value]) => {
    if (props.includes(key)) return memo
    return {
      ...memo,
      [key]: value
    }
  }, {})

export const flat = array =>
  array.reduce((memo, prop) => {
    const { name, ...rest } = prop
    return {
      ...memo,
      [name]: rest
    }
  }, {})

export const combineArray = (options) => {
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

export const combineDeepmerge = deepmerge({ mergeArray: combineArray })
export const toArray = obj =>
  obj && Object.entries(obj).map(([key, value]) => ({ name: key, ...value }))

export const REQUIRED = Symbol('required')
export const FLUENT_SCHEMA = Symbol.for('fluent-schema-object')

export const RELATIVE_JSON_POINTER = 'relative-json-pointer'
export const JSON_POINTER = 'json-pointer'
export const UUID = 'uuid'
export const REGEX = 'regex'
export const IPV6 = 'ipv6'
export const IPV4 = 'ipv4'
export const HOSTNAME = 'hostname'
export const EMAIL = 'email'
export const URL = 'url'
export const URI_TEMPLATE = 'uri-template'
export const URI_REFERENCE = 'uri-reference'
export const URI = 'uri'
export const TIME = 'time'
export const DATE = 'date'
export const DATE_TIME = 'date-time'

export const FORMATS = {
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

export const STRING = 'string'
export const NUMBER = 'number'
export const BOOLEAN = 'boolean'
export const INTEGER = 'integer'
export const OBJECT = 'object'
export const ARRAY = 'array'
export const NULL = 'null'

export const TYPES = {
  STRING,
  NUMBER,
  BOOLEAN,
  INTEGER,
  OBJECT,
  ARRAY,
  NULL
}

export const patchIdsWithParentId = ({ schema, generateIds, parentId }) => {
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

export const appendRequired = ({
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

export const setAttribute = ({ schema, ...options }, attribute) => {
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

export const setRaw = ({ schema, ...options }, raw) => {
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
export const setComposeType = ({ prop, schemas, schema, options }) => {
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
