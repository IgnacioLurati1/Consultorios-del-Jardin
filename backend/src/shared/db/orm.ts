import dotenv from 'dotenv'
dotenv.config()
import { MikroORM } from '@mikro-orm/core'
import { SqlHighlighter } from '@mikro-orm/sql-highlighter'
import { MySqlDriver } from '@mikro-orm/mysql'

/**
 * La conexión sale de DATABASE_URL, y el nombre de la base sale de adentro de esa URL.
 *
 * Escribir `dbName` acá además de la URL no es redundante: gana sobre lo que diga la
 * URL. En local no se notaba porque las dos decían `gardenOfficedb`, pero contra una
 * base creada por una plataforma —que le pone el nombre que quiere— el servidor se
 * conecta bien y después pide una base que no existe.
 *
 * El nombre fijo queda solo para cuando no hay URL, que es el caso de quien clona el
 * repo y levanta MySQL en su máquina sin configurar nada.
 */
const clientUrl = process.env.DATABASE_URL;

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