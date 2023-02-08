import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import merge from 'lodash.merge'

import S from './FluentJSONSchema.js'

describe('S', () => {
  it('defined', () => {
    expect(S).toBeDefined()
  })

  describe('factory', () => {
    it('without params', () => {
      expect(S.object().valueOf()).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object'
      })
    })

    describe('generatedIds', () => {
      describe('properties', () => {
        it('true', () => {
          expect(
            S.withOptions({ generateIds: true })
              .object()
              .prop('prop', S.string())
              .valueOf()
          ).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            properties: { prop: { $id: '#properties/prop', type: 'string' } },
            type: 'object'
          })
        })

        it('false', () => {
          expect(
            S.object()
              .prop('prop', S.string())
              .valueOf()
          ).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            properties: { prop: { type: 'string' } },
            type: 'object'
          })
        })

        describe('nested', () => {
          it('true', () => {
            expect(
              S.withOptions({ generateIds: true })
                .object()
                .prop(
                  'foo',
                  S.object()
                    .prop('bar', S.string())
                    .required()
                )
                .valueOf()
            ).toEqual({
              $schema: 'http://json-schema.org/draft-07/schema#',
              properties: {
                foo: {
                  $id: '#properties/foo',
                  properties: {
                    bar: {
                      $id: '#properties/foo/properties/bar',
                      type: 'string'
                    }
                  },
                  required: ['bar'],
                  type: 'object'
                }
              },
              type: 'object'
            })
          })
          it('false', () => {
            const id = 'myId'
            expect(
              S.object()
                .prop(
                  'foo',
                  S.object()
                    .prop('bar', S.string().id(id))

                    .required()
                )
                .valueOf()
            ).toEqual({
              $schema: 'http://json-schema.org/draft-07/schema#',
              properties: {
                foo: {
                  properties: {
                    bar: { $id: 'myId', type: 'string' }
                  },
                  required: ['bar'],
                  type: 'object'
                }
              },
              type: 'object'
            })
          })
        })
      })
      // TODO LS not sure the test makes sense
      describe('definitions', () => {
        it('true', () => {
          expect(
            S.withOptions({ generateIds: true })
              .object()
              .definition(
                'entity',
                S.object()
                  .prop('foo', S.string())
                  .prop('bar', S.string())
              )
              .prop('prop')
              .ref('entity')
              .valueOf()
          ).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            definitions: {
              entity: {
                $id: '#definitions/entity',
                properties: {
                  bar: {
                    type: 'string'
                  },
                  foo: {
                    type: 'string'
                  }
                },
                type: 'object'
              }
            },
            properties: {
              prop: {
                $ref: 'entity'
              }
            },
            type: 'object'
          })
        })

        it('false', () => {
          expect(
            S.withOptions({ generateIds: false })
              .object()
              .definition(
                'entity',
                S.object()
                  .id('myCustomId')
                  .prop('foo', S.string())
              )
              .prop('prop')
              .ref('entity')
              .valueOf()
          ).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            definitions: {
              entity: {
                $id: 'myCustomId',
                properties: {
                  foo: { type: 'string' }
                },
                type: 'object'
              }
            },
            properties: {
              prop: {
                $ref: 'entity'
              }
            },
            type: 'object'
          })
        })

        it('nested', () => {
          const id = 'myId'
          expect(
            S.object()
              .prop(
                'foo',
                S.object()
                  .prop('bar', S.string().id(id))
                  .required()
              )
              .valueOf()
          ).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            properties: {
              foo: {
                properties: {
                  bar: { $id: 'myId', type: 'string' }
                },
                required: ['bar'],
                type: 'object'
              }
            },
            type: 'object'
          })
        })
      })
    })
  })

  describe('composition', () => {
    it('anyOf', () => {
      const schema = S.object()
        .prop('foo', S.anyOf([S.string()]))
        .valueOf()
      expect(schema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: { foo: { anyOf: [{ type: 'string' }] } },
        type: 'object'
      })
    })

    it('oneOf', () => {
      const schema = S.object()
        .prop(
          'multipleRestrictedTypesKey',
          S.oneOf([S.string(), S.number().minimum(10)])
        )
        .prop('notTypeKey', S.not(S.oneOf([S.string().pattern('js$')])))
        .valueOf()
      expect(schema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          multipleRestrictedTypesKey: {
            oneOf: [{ type: 'string' }, { minimum: 10, type: 'number' }]
          },
          notTypeKey: { not: { oneOf: [{ pattern: 'js$', type: 'string' }] } }
        },
        type: 'object'
      })
    })
  })

  it('valueOf', () => {
    expect(
      S.object()
        .prop('foo', S.string())
        .valueOf()
    ).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      properties: { foo: { type: 'string' } },
      type: 'object'
    })
  })

  it('works', () => {
    const schema = S.object()
      .id('http://foo.com/user')
      .title('A User')
      .description('A User desc')
      .definition(
        'address',
        S.object()
          .id('#address')
          .prop('country', S.string())
          .prop('city', S.string())
          .prop('zipcode', S.string())
      )
      .prop('username', S.string())
      .required()
      .prop('password', S.string())
      .required()
      .prop('address', S.ref('#address'))

      .required()
      .prop(
        'role',
        S.object()
          .id('http://foo.com/role')
          .prop('name', S.string())
          .prop('permissions', S.string())
      )
      .required()
      .prop('age', S.number())

      .valueOf()

    expect(schema).toEqual({
      definitions: {
        address: {
          type: 'object',
          $id: '#address',
          properties: {
            country: {
              type: 'string'
            },
            city: {
              type: 'string'
            },
            zipcode: {
              type: 'string'
            }
          }
        }
      },
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['username', 'password', 'address', 'role'],
      $id: 'http://foo.com/user',
      title: 'A User',
      description: 'A User desc',
      properties: {
        username: {
          type: 'string'
        },
        password: {
          type: 'string'
        },
        address: {
          $ref: '#address'
        },
        age: {
          type: 'number'
        },
        role: {
          type: 'object',
          $id: 'http://foo.com/role',
          properties: {
            name: {
              type: 'string'
            },
            permissions: {
              type: 'string'
            }
          }
        }
      }
    })
  })

  describe('raw', () => {
    describe('base', () => {
      it('parses type', () => {
        const input = S.enum(['foo']).valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('adds an attribute', () => {
        const input = S.enum(['foo']).valueOf()
        const schema = S.raw(input)
        const attribute = 'title'
        const modified = schema.title(attribute)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(modified.valueOf()).toEqual({
          ...input,
          title: attribute
        })
      })
    })

    describe('string', () => {
      it('parses type', () => {
        const input = S.string().valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('adds an attribute', () => {
        const input = S.string().valueOf()
        const schema = S.raw(input)
        const modified = schema.minLength(3)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(modified.valueOf()).toEqual({
          minLength: 3,
          ...input
        })
      })

      it('parses a prop', () => {
        const input = S.string()
          .minLength(5)
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })
    })

    describe('number', () => {
      it('parses type', () => {
        const input = S.number().valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('adds an attribute', () => {
        const input = S.number().valueOf()
        const schema = S.raw(input)
        const modified = schema.maximum(3)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(modified.valueOf()).toEqual({
          maximum: 3,
          ...input
        })
      })

      it('parses a prop', () => {
        const input = S.number()
          .maximum(5)
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })
    })

    describe('integer', () => {
      it('parses type', () => {
        const input = S.integer().valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('adds an attribute', () => {
        const input = S.integer().valueOf()
        const schema = S.raw(input)
        const modified = schema.maximum(3)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(modified.valueOf()).toEqual({
          maximum: 3,
          ...input
        })
      })

      it('parses a prop', () => {
        const input = S.integer()
          .maximum(5)
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })
    })

    describe('boolean', () => {
      it('parses type', () => {
        const input = S.boolean().valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })
    })

    describe('object', () => {
      it('parses type', () => {
        const input = S.object().valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('parses properties', () => {
        const input = S.object()
          .prop('foo')
          .prop('bar', S.string())
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('parses nested properties', () => {
        const input = S.object()
          .prop('foo', S.object().prop('bar', S.string().minLength(3)))
          .valueOf()
        const schema = S.raw(input)
        const modified = schema.prop('boom')
        expect(modified.isFluentSchema).toBeTruthy()
        expect(modified.valueOf()).toEqual({
          ...input,
          properties: {
            ...input.properties,
            boom: {}
          }
        })
      })

      it('parses definitions', () => {
        const input = S.object()
          .definition('foo', S.string())
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })
    })

    describe('array', () => {
      it('parses type', () => {
        const input = S.array()
          .items(S.string())
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })

      it('parses properties', () => {
        const input = S.array()
          .items(S.string())
          .valueOf()

        const schema = S.raw(input).maxItems(1)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input,
          maxItems: 1
        })
      })

      it('parses nested properties', () => {
        const input = S.array()
          .items(
            S.object().prop(
              'foo',
              S.object().prop('bar', S.string().minLength(3))
            )
          )
          .valueOf()
        const schema = S.raw(input)
        const modified = schema.maxItems(1)
        expect(modified.isFluentSchema).toBeTruthy()
        expect(modified.valueOf()).toEqual({
          ...input,
          maxItems: 1
        })
      })

      it('parses definitions', () => {
        const input = S.object()
          .definition('foo', S.string())
          .valueOf()
        const schema = S.raw(input)
        expect(schema.isFluentSchema).toBeTruthy()
        expect(schema.valueOf()).toEqual({
          ...input
        })
      })
    })
  })
})

const basic = [
  {
    description: 'basic schema from z-schema benchmark (https://github.com/zaggino/z-schema)',
    schema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Product set',
      type: 'array',
      items: {
        title: 'Product',
        type: 'object',
        properties: {
          uuid: {
            description: 'The unique identifier for a product',
            type: 'number'
          },
          name: {
            type: 'string'
          },
          price: {
            type: 'number',
            exclusiveMinimum: 0
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            minItems: 1,
            uniqueItems: true
          },
          dimensions: {
            type: 'object',
            properties: {
              length: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' }
            },
            required: ['length', 'width', 'height']
          },
          warehouseLocation: {
            description: 'Coordinates of the warehouse with the product',
            type: 'string'
          }
        },
        required: ['uuid', 'name', 'price']
      }
    },
    tests: [
      {
        description: 'valid array from z-schema benchmark',
        data: [
          {
            id: 2,
            name: 'An ice sculpture',
            price: 12.5,
            tags: ['cold', 'ice'],
            dimensions: {
              length: 7.0,
              width: 12.0,
              height: 9.5
            },
            warehouseLocation: {
              latitude: -78.75,
              longitude: 20.4
            }
          },
          {
            id: 3,
            name: 'A blue mouse',
            price: 25.5,
            dimensions: {
              length: 3.1,
              width: 1.0,
              height: 1.0
            },
            warehouseLocation: {
              latitude: 54.4,
              longitude: -32.7
            }
          }
        ],
        valid: true
      },
      {
        description: 'not array',
        data: 1,
        valid: false
      },
      {
        description: 'array of not onjects',
        data: [1, 2, 3],
        valid: false
      },
      {
        description: 'missing required properties',
        data: [{}],
        valid: false
      },
      {
        description: 'required property of wrong type',
        data: [{ id: 1, name: 'product', price: 'not valid' }],
        valid: false
      },
      {
        description: 'smallest valid product',
        data: [{ id: 1, name: 'product', price: 100 }],
        valid: true
      },
      {
        description: 'tags should be array',
        data: [{ tags: {}, id: 1, name: 'product', price: 100 }],
        valid: false
      },
      {
        description: 'dimensions should be object',
        data: [
          { dimensions: [], id: 1, name: 'product', price: 100 }
        ],
        valid: false
      },
      {
        description: 'valid product with tag',
        data: [
          { tags: ['product'], id: 1, name: 'product', price: 100 }
        ],
        valid: true
      },
      {
        description: 'dimensions miss required properties',
        data: [
          {
            dimensions: {},
            tags: ['product'],
            id: 1,
            name: 'product',
            price: 100
          }
        ],
        valid: false
      },
      {
        description: 'valid product with tag and dimensions',
        data: [
          {
            dimensions: { length: 7, width: 12, height: 9.5 },
            tags: ['product'],
            id: 1,
            name: 'product',
            price: 100
          }
        ],
        valid: true
      }
    ]
  }
]

// TODO pick some ideas from here:https://github.com/json-schema-org/JSON-Schema-Test-Suite/tree/master/tests/draft7

describe('S', () => {
  it('compiles', () => {
    const ajv = new Ajv()
    const schema = S.valueOf()
    const validate = ajv.compile(schema)
    const valid = validate({})
    expect(valid).toBeTruthy()
  })

  describe('basic', () => {
    const ajv = new Ajv()
    const schema = S.object()
      .prop('username', S.string())
      .prop('password', S.string())
      .valueOf()
    const validate = ajv.compile(schema)

    it('valid', () => {
      const valid = validate({
        username: 'username',
        password: 'password'
      })
      expect(valid).toBeTruthy()
    })

    it('invalid', () => {
      const valid = validate({
        username: 'username',
        password: 1
      })
      expect(validate.errors).toEqual([
        {
          instancePath: '/password',
          keyword: 'type',
          message: 'must be string',
          params: { type: 'string' },
          schemaPath: '#/properties/password/type'
        }
      ])
      expect(valid).not.toBeTruthy()
    })
  })

  describe('ifThen', () => {
    const ajv = new Ajv()
    const schema = S.object()
      .prop('prop', S.string().maxLength(5))
      .ifThen(
        S.object().prop('prop', S.string().maxLength(5)),
        S.object()
          .prop('extraProp', S.string())
          .required()
      )
      .valueOf()
    const validate = ajv.compile(schema)

    it('valid', () => {
      const valid = validate({
        prop: '12345',
        extraProp: 'foo'
      })
      expect(valid).toBeTruthy()
    })

    it('invalid', () => {
      const valid = validate({
        prop: '12345'
      })
      expect(validate.errors).toEqual([
        {
          instancePath: '',
          keyword: 'required',
          message: "must have required property 'extraProp'",
          params: { missingProperty: 'extraProp' },
          schemaPath: '#/then/required'
        }
      ])
      expect(valid).not.toBeTruthy()
    })
  })

  describe('ifThenElse', () => {
    const ajv = new Ajv()

    const VALUES = ['ONE', 'TWO']
    const schema = S.object()
      .prop('ifProp')
      .ifThenElse(
        S.object().prop('ifProp', S.string().enum([VALUES[0]])),
        S.object()
          .prop('thenProp', S.string())
          .required(),
        S.object()
          .prop('elseProp', S.string())
          .required()
      )
      .valueOf()

    const validate = ajv.compile(schema)

    it('then', () => {
      const valid = validate({
        ifProp: 'ONE',
        thenProp: 'foo'
      })
      expect(valid).toBeTruthy()
    })

    it('else', () => {
      const valid = validate({
        prop: '123456'
      })
      expect(validate.errors).toEqual([
        {
          instancePath: '',
          keyword: 'required',
          message: "must have required property 'thenProp'",
          params: { missingProperty: 'thenProp' },
          schemaPath: '#/then/required'
        }
      ])
      expect(valid).not.toBeTruthy()
    })
  })

  describe('combine and definition', () => {
    const ajv = new Ajv()
    const schema = S.object() // FIXME LS it shouldn't be object()
      .definition(
        'address',
        S.object()
          .id('#/definitions/address')
          .prop('street_address', S.string())
          .required()
          .prop('city', S.string())
          .required()
          .prop('state', S.string().required())
      )
      .allOf([
        S.ref('#/definitions/address'),
        S.object()
          .prop('type', S.string())
          .enum(['residential', 'business'])
      ])
      .valueOf()
    const validate = ajv.compile(schema)
    it('matches', () => {
      expect(schema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        definitions: {
          address: {
            $id: '#/definitions/address',
            type: 'object',
            properties: {
              street_address: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' }
            },
            required: ['street_address', 'city', 'state']
          }
        },
        allOf: [
          { $ref: '#/definitions/address' },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['residential', 'business'] }
            }
          }
        ]
      })
    })

    it('valid', () => {
      const valid = validate({
        street_address: 'via Paolo Rossi',
        city: 'Topolinia',
        state: 'Disney World',
        type: 'business'
      })
      expect(validate.errors).toBeNull()
      expect(valid).toBeTruthy()
    })
  })

  // https://github.com/fastify/fluent-json-schema/pull/40
  describe('cloning objects retains boolean', () => {
    const ajv = new Ajv()
    const config = {
      schema: S.object().prop('foo', S.string().enum(['foo']))
    }
    const _config = merge({}, config)
    const schema = _config.schema.valueOf()
    const validate = ajv.compile(schema)
    it('matches', () => {
      expect(config.schema[Symbol.for('fluent-schema-object')]).toBeDefined()
      expect(_config.schema.isFluentJSONSchema).toBeTruthy()
      expect(_config.schema[Symbol.for('fluent-schema-object')]).toBeUndefined()
      expect(schema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          foo: {
            type: 'string',
            enum: ['foo']
          }
        }
      })
    })

    it('valid', () => {
      const valid = validate({ foo: 'foo' })
      expect(validate.errors).toBeNull()
      expect(valid).toBeTruthy()
    })
  })

  describe('compose keywords', () => {
    const ajv = new Ajv()
    const schema = S.object()
      .prop('foo', S.anyOf([S.string()]))
      .prop('bar', S.not(S.anyOf([S.integer()])))
      .prop('prop', S.allOf([S.string(), S.boolean()]))
      .prop('anotherProp', S.oneOf([S.string(), S.boolean()]))
      .required()
      .valueOf()

    const validate = ajv.compile(schema)

    it('valid', () => {
      const valid = validate({
        foo: 'foo',
        anotherProp: true
      })
      expect(valid).toBeTruthy()
    })

    it('invalid', () => {
      const valid = validate({
        foo: 'foo',
        bar: 1
      })
      expect(valid).toBeFalsy()
    })
  })

  describe('compose ifThen', () => {
    const ajv = new Ajv()
    const schema = S.object()
      .prop(
        'foo',
        S.string()
          .default(false)
          .required()
      )
      .prop(
        'bar',
        S.string()
          .default(false)
          .required()
      )
      .prop('thenFooA', S.string())
      .prop('thenFooB', S.string())
      .allOf([
        S.ifThen(
          S.object()
            .prop('foo', S.string())
            .enum(['foo']),
          S.required(['thenFooA', 'thenFooB'])
        ),
        S.ifThen(
          S.object()
            .prop('bar', S.string())
            .enum(['BAR']),
          S.required(['thenBarA', 'thenBarB'])
        )
      ])
      .valueOf()

    const validate = ajv.compile(schema)
    it('matches', () => {
      expect(schema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        allOf: [
          {
            if: {
              properties: {
                foo: { $id: undefined, enum: ['foo'], type: 'string' }
              }
            },
            then: { required: ['thenFooA', 'thenFooB'] }
          },
          {
            if: {
              properties: {
                bar: { $id: undefined, enum: ['BAR'], type: 'string' }
              }
            },
            then: { required: ['thenBarA', 'thenBarB'] }
          }
        ],
        properties: {
          bar: { default: false, type: 'string' },
          foo: { default: false, type: 'string' },
          thenFooA: { type: 'string' },
          thenFooB: { type: 'string' }
        },
        required: ['foo', 'bar'],
        type: 'object'
      })
    })

    it('valid', () => {
      const valid = validate({
        foo: 'foo',
        thenFooA: 'thenFooA',
        thenFooB: 'thenFooB',
        bar: 'BAR',
        thenBarA: 'thenBarA',
        thenBarB: 'thenBarB'
      })
      expect(validate.errors).toBeNull()
      expect(valid).toBeTruthy()
    })
  })

  describe('complex', () => {
    const ajv = new Ajv()
    const schema = S.object()
      .id('http://foo.com/user')
      .title('A User')
      .description('A User desc')
      .definition(
        'address',
        S.object()
          .id('#address')
          .prop('country', S.string())
          .prop('city', S.string())
          .prop('zipcode', S.string())
      )
      .prop('username', S.string())
      .required()
      .prop('password', S.string().required())
      .prop('address', S.object().ref('#address'))

      .required()
      .prop(
        'role',
        S.object()
          .id('http://foo.com/role')
          .required()
          .prop('name', S.string())
          .prop('permissions')
      )
      .prop('age', S.number())
      .valueOf()
    const validate = ajv.compile(schema)
    it('valid', () => {
      const valid = validate({
        username: 'aboutlo',
        password: 'pwsd',
        address: {
          country: 'Italy',
          city: 'Milan',
          zipcode: '20100'
        },
        role: {
          name: 'admin',
          permissions: 'read:write'
        },
        age: 30
      })
      expect(valid).toBeTruthy()
    })

    describe('invalid', () => {
      const model = {
        username: 'aboutlo',
        password: 'pswd',
        address: {
          country: 'Italy',
          city: 'Milan',
          zipcode: '20100'
        },
        role: {
          name: 'admin',
          permissions: 'read:write'
        },
        age: 30
      }
      it('password', () => {
        const { password, ...data } = model
        const valid = validate(data)
        expect(validate.errors).toEqual([
          {
            instancePath: '',
            keyword: 'required',
            message: "must have required property 'password'",
            params: { missingProperty: 'password' },
            schemaPath: '#/required'
          }
        ])
        expect(valid).not.toBeTruthy()
      })
      it('address', () => {
        const { address, ...data } = model
        const valid = validate({
          ...data,
          address: {
            ...address,
            city: 1234
          }
        })
        expect(validate.errors).toEqual([
          {
            instancePath: '/address/city',
            keyword: 'type',
            message: 'must be string',
            params: { type: 'string' },
            schemaPath: '#address/properties/city/type'
          }
        ])
        expect(valid).not.toBeTruthy()
      })
    })
  })

  describe('basic.json', () => {
    it('generate', () => {
      const [step] = basic
      expect(
        S.array()
          .title('Product set')
          .items(
            S.object()
              .title('Product')
              .prop(
                'uuid',
                S.number()
                  .description('The unique identifier for a product')
                  .required()
              )
              .prop('name', S.string())
              .required()
              .prop(
                'price',
                S.number()
                  .exclusiveMinimum(0)
                  .required()
              )
              .prop(
                'tags',
                S.array()
                  .items(S.string())
                  .minItems(1)
                  .uniqueItems(true)
              )

              .prop(
                'dimensions',
                S.object()
                  .prop('length', S.number().required())

                  .prop('width', S.number().required())
                  .prop('height', S.number().required())
              )
              .prop(
                'warehouseLocation',
                S.string().description(
                  'Coordinates of the warehouse with the product'
                )
              )
          )
          .valueOf()
      ).toEqual(step.schema)
    })
  })

  describe('raw', () => {
    describe('swaggger', () => {
      describe('nullable', () => {
        it('allows nullable', () => {
          const ajv = new Ajv()
          const schema = S.object()
            .prop('foo', S.raw({ nullable: true, type: 'string' }))
            .valueOf()
          const validate = ajv.compile(schema)
          const valid = validate({
            test: null
          })
          expect(validate.errors).toBeNull()
          expect(valid).toBeTruthy()
        })
      })
    })

    describe('ajv', () => {
      describe('formatMaximum', () => {
        it('checks custom keyword formatMaximum', () => {
          const ajv = new Ajv()
          ajvFormats(ajv)
          /*        const schema = S.string()
            .raw({ nullable: false })
            .valueOf() */
          // { type: 'number', nullable: true }
          const schema = S.object()
            .prop(
              'birthday',
              S.raw({
                format: 'date',
                formatMaximum: '2020-01-01',
                type: 'string'
              })
            )
            .valueOf()

          const validate = ajv.compile(schema)
          const valid = validate({
            birthday: '2030-01-01'
          })
          expect(validate.errors).toEqual([
            {
              instancePath: '/birthday',
              keyword: 'formatMaximum',
              message: 'should be <= 2020-01-01',
              params: {
                comparison: '<=',
                limit: '2020-01-01'
              },
              schemaPath: '#/properties/birthday/formatMaximum'
            }
          ])
          expect(valid).toBeFalsy()
        })
        it('checks custom keyword larger with $data', () => {
          const ajv = new Ajv({ $data: true })
          ajvFormats(ajv)
          /*        const schema = S.string()
            .raw({ nullable: false })
            .valueOf() */
          // { type: 'number', nullable: true }
          const schema = S.object()
            .prop('smaller', S.number().raw({ maximum: { $data: '1/larger' } }))
            .prop('larger', S.number())
            .valueOf()

          const validate = ajv.compile(schema)
          const valid = validate({
            smaller: 10,
            larger: 7
          })
          expect(validate.errors).toEqual([
            {
              instancePath: '/smaller',
              keyword: 'maximum',
              message: 'must be <= 7',
              params: {
                comparison: '<=',
                limit: 7
              },
              schemaPath: '#/properties/smaller/maximum'
            }
          ])
          expect(valid).toBeFalsy()
        })
      })
    })
  })
})
