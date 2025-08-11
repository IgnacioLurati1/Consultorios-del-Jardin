import { Entity, PrimaryKey, Property } from '@mikro-orm/core'

@Entity()
export class Person {
    
    @PrimaryKey()
    email?: string

    @Property({ nullable: false, unique: false })
    docType!: string

    @Property({ nullable: false, unique: false })
    docNumber!: string

    @Property({ nullable: false, unique: false })
    name!: string

    @Property({ nullable: false, unique: false })
    surname!: string

    @Property({ nullable: false, unique: false })
    phoneNumber!: string

    @Property({ nullable: false, unique: false })
    password!: string

    @Property({nullable: false})
    state!: boolean
    
}