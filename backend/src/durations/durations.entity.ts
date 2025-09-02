import {
    Entity,
    Property,
    PrimaryKey,
} from '@mikro-orm/core'

@Entity()
export class Duration {

  @Property({nullable: false})
  duration!: string

  @PrimaryKey({nullable: false})
  id!: string

}