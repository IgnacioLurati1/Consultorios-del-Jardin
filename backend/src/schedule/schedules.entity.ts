import {
    Entity,
    Property,
    PrimaryKey,
    ManyToOne,
    Rel,
    ManyToMany,
    Cascade,
    Collection,
    Unique
} from '@mikro-orm/core'
import { Person } from '../people/people.entity.js'
import { Room } from '../rooms/rooms.entity.js'
import { Duration} from '../durations/durations.entity.js'
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

    @ManyToMany(() => Duration, undefined, { cascade: [Cascade.ALL] })
    durations = new Collection<Duration>(this);

}