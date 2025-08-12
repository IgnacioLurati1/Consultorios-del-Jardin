import {
  Entity,
  OneToMany,
  Property,
  Cascade,
  Collection,
  PrimaryKey,
} from '@mikro-orm/core'
import { City } from '../cities/cities.entity.js'

@Entity()

export class Province {
    @PrimaryKey()
    idProvince?: number
  
    @Property({nullable: false, unique: true})
    nameProvince!: string

    @Property({nullable: false})
    active!: boolean

    @OneToMany(() => City, (city) => city.province, {
      cascade: [Cascade.ALL],
    })
    cities = new Collection<City>(this)

}