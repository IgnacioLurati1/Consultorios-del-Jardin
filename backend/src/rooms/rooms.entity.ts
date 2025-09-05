import {
    Entity,
    Property,
    PrimaryKey,
    ManyToOne,
    Rel,
    Unique
} from '@mikro-orm/core'
import { Office } from '../offices/offices.entity.js'

@Entity()
@Unique({ properties: ['office', 'description'] })
export class Room {

  @PrimaryKey()
  idRoom?: number

  @Property({ nullable: false, unique: false })
  description!: string

  @Property({nullable: false})
  active!: boolean

  @ManyToOne(() => Office, { nullable: false })
  office!: Rel<Office>

}