import {
  Entity,
  OneToMany,
  Property,
  Cascade,
  Collection,
  PrimaryKey,
  ManyToOne,
  Rel,
} from '@mikro-orm/core'
import { Province } from '../provinces/provinces.entity.js'
import { Office } from '../offices/offices.entity.js'

@Entity()

export class City {
  @PrimaryKey()
  idCity?: number

  @Property({ nullable: false, unique: false })
  nameCity!: string
  
  @Property({nullable: false})
  state!: boolean

  @ManyToOne(() => Province, { nullable: false })
  province!: Rel<Province>;

  @OneToMany(() => Office, (office) => office.city, {cascade: [Cascade.ALL]})
  offices = new Collection<Office>(this);
}