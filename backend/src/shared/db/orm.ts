import dotenv from 'dotenv'
dotenv.config()
import { MikroORM } from '@mikro-orm/core'
import { SqlHighlighter } from '@mikro-orm/sql-highlighter'
import { MySqlDriver } from '@mikro-orm/mysql'

/** Los nombres con los que puede llegar la cadena de conexión entera. */
const URL_VARS = ['DATABASE_URL', 'MYSQL_URL', 'MYSQL_DATABASE', 'MYSQLDATABASE']

/**
 * Cómo llegar a la base.
 *
 * No hay un solo nombre de variable posible: cada plataforma publica el suyo, y algunas
 * no dejan elegirlo. Así que se busca la cadena de conexión en varios nombres y, si no
 * aparece entera, se arma con las piezas sueltas.
 *
 * La condición para aceptar un valor es que empiece con `mysql://`, no que la variable
 * se llame de cierta forma. Es la diferencia entre una cadena de conexión y el solo
 * nombre de la base: hay variables que se llaman parecido y contienen una cosa o la
 * otra, y tomar la equivocada terminaba en una conexión a localhost que nadie pidió.
 */
function resolveClientUrl(): string | undefined {
    for (const name of URL_VARS) {
        const value = process.env[name]?.trim()
        if (value && /^mysql:\/\//i.test(value)) return value
    }

    // Sin cadena entera, se arma con lo que haya suelto.
    const host = process.env.MYSQLHOST
    const user = process.env.MYSQLUSER
    const database = process.env.MYSQLDATABASE ?? process.env.MYSQL_DATABASE

    if (!host || !user || !database) return undefined

    const password = encodeURIComponent(process.env.MYSQLPASSWORD ?? '')
    const port = process.env.MYSQLPORT ?? '3306'

    return `mysql://${encodeURIComponent(user)}:${password}@${host}:${port}/${database}`
}

const clientUrl = resolveClientUrl()

/**
 * Sin conexión configurada, MikroORM cae en localhost y el servidor muere con un
 * "connect ECONNREFUSED 127.0.0.1:3306" que no dice qué falta. Desplegado eso no es un
 * descuido recuperable: es que nadie cargó la variable, y conviene decirlo con esas
 * palabras. En local se deja pasar, porque ahí localhost es exactamente lo que se quiere.
 */
if (!clientUrl && process.env.NODE_ENV === 'production') {
    // Los nombres de lo que sí llegó, nunca los valores: alcanzan para ver si la variable
    // está y se llama distinto, o si directamente no está, y no arrastran la contraseña
    // a un registro que queda guardado.
    const presentes = Object.keys(process.env)
        .filter((name) => /mysql|database|db_/i.test(name))
        .sort()

    const encontradas = presentes.length
        ? `Variables con pinta de base que sí llegaron: ${presentes.join(', ')}.`
        : `No llegó ninguna variable con pinta de base de datos.`

    throw new Error(
        `No hay conexión a la base configurada. Definí una variable con la cadena entera ` +
            `(${URL_VARS.join(', ')}), con la forma mysql://usuario:contraseña@host:puerto/base, ` +
            `o bien MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLPORT y MYSQLDATABASE por separado. ` +
            encontradas
    )
}

export const orm = await MikroORM.init({
    entities: ['dist/**/*.entity.js'],
    entitiesTs: ['src/**/*.entity.ts'],
    ...(clientUrl ? { clientUrl } : { dbName: 'gardenOfficedb' }),
    driver: MySqlDriver,
    highlighter: new SqlHighlighter(),
    // Cada consulta con sus valores, que en este sistema son nombres, emails y horarios
    // de pacientes. Sirve mientras se desarrolla; en un servidor es volcarlo todo a un
    // registro que queda guardado.
    debug: process.env.NODE_ENV !== 'production',
    schemaGenerator: {
        //never in production
        disableForeignKeys: true,
        createForeignKeyConstraints: true,
        ignoreSchema: [],
    },
})

export const syncSchema = async () => {
  const generator = orm.getSchemaGenerator()
  /*   
  await generator.dropSchema()
  await generator.createSchema()
  */
  await generator.updateSchema()
}