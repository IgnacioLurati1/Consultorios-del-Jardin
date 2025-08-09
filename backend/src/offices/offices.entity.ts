import {
  Entity,
  Property,
  PrimaryKey,
  ManyToOne,
  Rel,
} from '@mikro-orm/core'
import { City } from '../cities/cities.entity.js'

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
  @ManyToOne(() => City, { nullable: false })
  city!: Rel<City>

  //falta OneToMany con "Rooms".

}