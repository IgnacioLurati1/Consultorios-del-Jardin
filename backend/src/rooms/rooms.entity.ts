import {
    Entity,
    Property,
    PrimaryKey,
    ManyToOne,
    Rel,
} from '@mikro-orm/core'
import { Office } from '../offices/offices.entity.js'

@Entity()
export class Room {

  @PrimaryKey()
  idRoom?: number

  @Property({ nullable: false, unique: false })
  description!: string

  @ManyToOne(() => Office, { nullable: false })
  office!: Rel<Office>

}