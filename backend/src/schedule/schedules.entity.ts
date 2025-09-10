import {
    Entity,
    Property,
    PrimaryKey,
    ManyToOne,
    Rel,
    Unique
} from '@mikro-orm/core'
import { Person } from '../people/people.entity.js'
import { Room } from '../rooms/rooms.entity.js'
@Entity()
@Unique({ properties: ['day', 'initialHour', 'person', 'room'] })
export class Schedule {
    @PrimaryKey()
    day!: string

    @PrimaryKey()
    initialHour!: string

    @ManyToOne(() => Person, { nullable: false })
    person!: Rel<Person>
    
    @ManyToOne(() => Room, { nullable: false })
    room!: Rel<Room>

    @Property({nullable: false})
    finalHour!: string

    @Property({nullable: false})
    active!: boolean

    @Property({nullable: false})
    allowedType!: string

    @Property({nullable: false})
    duration!: number
}