import {
  Entity,
  Property,
  PrimaryKey,
  ManyToOne,
  Rel,
  OneToMany,
  Collection,
  Cascade,
} from '@mikro-orm/core'
import { City } from '../cities/cities.entity.js'
import { Room } from '../rooms/rooms.entity.js'

@Entity()
export class Office {

  @PrimaryKey()
  idOffice?: number
  
  @Property({ nullable: false, unique: false })
  closingTime!: string

  @Property({ nullable: false, unique: false })
  openingTime!: string

  @Property({ nullable: false, unique: false })
  description!: string

  @Property({nullable: false})
  active!: boolean

  @ManyToOne(() => City, { nullable: false })
  city!: Rel<City>

  @OneToMany(() => Room, (room) => room.office, {cascade: [Cascade.ALL]})
    rooms = new Collection<Room>(this);

}