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
        // Las comillas se sacan porque un valor copiado de un archivo .env se pega con
        // ellas puestas, y entonces no empieza con "mysql://" sino con una comilla: el
        // valor es correcto y aun así se descarta.
        const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
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
    // Todo lo que hay en el ambiente, por nombre. Nunca los valores: adentro viven la
    // contraseña de la base y las claves de los servicios, y esto va a un registro que
    // queda guardado. Con los nombres alcanza para ver si una variable llegó o no.
    console.error('')
    console.error('Variables presentes en el contenedor (solo nombres):')
    for (const name of Object.keys(process.env).sort()) console.error(`  ${name}`)

    // Estas tres sí van con su valor: dicen a qué servicio, a qué ambiente y a qué commit
    // corresponde este contenedor. Es lo primero a mirar cuando una variable está cargada
    // en la pantalla y no aparece en la lista de arriba. No son secretas.
    console.error('')
    console.error('De qué deploy se trata:')
    for (const name of ['RAILWAY_SERVICE_NAME', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_GIT_COMMIT_SHA']) {
        console.error(`  ${name} = ${process.env[name] ?? '(no está)'}`)
    }
    console.error('')

    // Y el valor de las candidatas a conexión, cortado. Los primeros caracteres alcanzan
    // para ver todo lo que importa —si está vacía, si quedaron las llaves de una
    // referencia sin resolver, si es el nombre de la base en vez de la cadena— y el
    // largo confirma que no está truncada. Entera no, porque adentro va la contraseña
    // de la base y esto queda escrito en el registro del servidor.
    console.error('Qué traen las variables de conexión:')
    for (const name of URL_VARS) {
        const raw = process.env[name]
        if (raw === undefined) continue
        console.error(`  ${name} = "${raw.slice(0, 20)}${raw.length > 20 ? '…' : ''}" (${raw.length} caracteres)`)
    }
    console.error('')

    // Los nombres de lo que sí llegó, nunca los valores: alcanzan para ver si la variable
    // está y se llama distinto, o si directamente no está, y no arrastran la contraseña
    // a un registro que queda guardado.
    const presentes = Object.keys(process.env)
        .filter((name) => /mysql|database|db_/i.test(name))
        .sort()
        .map((name) => {
            // Por qué no sirvió, que es lo que hay que saber para arreglarla. Una variable
            // vacía —el resultado de una referencia que no resolvió— y una con un valor que
            // no es una cadena de conexión se ven igual desde afuera y se arreglan distinto.
            const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
            if (!value) return `${name} (vacía)`
            if (!/^mysql:\/\//i.test(value)) return `${name} (su valor no arranca con mysql://)`
            return name
        })

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