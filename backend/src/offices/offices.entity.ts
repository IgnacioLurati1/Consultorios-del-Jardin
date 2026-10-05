import {
  Entity,
  Property,
  PrimaryKey,
  ManyToOne,
  Rel,
  OneToMany,
  Collection,
  Cascade,
  Unique,
} from '@mikro-orm/core'
import { City } from '../cities/cities.entity.js'
import { Room } from '../rooms/rooms.entity.js'

@Entity()
@Unique({ properties: ['city', 'description'] })
export class Office {

  @PrimaryKey()
  idOffice?: number
  
  @Property({ nullable: false, unique: false })
  closingTime!: string

  @Property({ nullable: false, unique: false })
  openingTime!: string

  @Property({ nullable: false, unique: false })
  description!: string

  /**
   * Calle y número de la sucursal. Con una sola sucursal no hace falta: la dirección es la
   * del consultorio (ver Installation). Con varias, es la que va en el recordatorio y en la
   * portada de cada una.
   */
  @Property({ nullable: true, length: 160 })
  address?: string | null = null

  @Property({nullable: false})
  active!: boolean

  @ManyToOne(() => City, { nullable: false })
  city!: Rel<City>

  @OneToMany(() => Room, (room) => room.office, {cascade: [Cascade.ALL]})
    rooms = new Collection<Room>(this);

}