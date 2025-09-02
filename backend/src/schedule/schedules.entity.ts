import {
    Entity,
    Property,
    PrimaryKey,
    ManyToOne,
    Rel,
    ManyToMany,
    Cascade,
    Collection
} from '@mikro-orm/core'
import { Person } from '../people/people.entity.js'
import { Room } from '../rooms/rooms.entity.js'
import { Duration} from '../durations/durations.entity.js'
@Entity()
export class Schedule {

    @PrimaryKey()
    day!: string

    @PrimaryKey()
    initialHour!: string

    @ManyToOne(() => Person, { nullable: false })
    Person!: Rel<Person>
    
    @ManyToOne(() => Room, { nullable: false })
    Room!: Rel<Room>

    @Property({nullable: false})
    finalHour!: boolean

    @Property({nullable: false})
    state!: string

    @Property({nullable: false})
    allowedType!: string

    @ManyToMany(() => Duration, undefined, { cascade: [Cascade.ALL] })
    durations = new Collection<Duration>(this);

}