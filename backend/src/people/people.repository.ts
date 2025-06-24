import { Repository } from '../shared/repository.js'
import { Person } from './people.entity.js'

const people = [
    new Person(
        'olivieri03@gmail.com',
        'dni',
        '45000000',
        'luca',
        'olivieri',
        '3410000000',
        '1234',
    ),
]

export class PeopleRepository implements Repository<Person> {
    public findAll(): Person[] | undefined {
        return people
}

    public findOne(item: { id: string }): Person | undefined {
        return people.find((person) => person.email === item.id)
    }

    public add(item: Person): Person | undefined {
        people.push(item)
        return item
    }

    public update(item: Person): Person | undefined {
        const emailx = people.findIndex((person) => person.email === item.email)

        if (emailx !== -1) {
            people[emailx] = { ...people[emailx], ...item }
        }
        return people[emailx]
    }

    public delete(item: { id: string }): Person | undefined {
        const emailx = people.findIndex((person) => person.email === item.id)

    if (emailx !== -1) {
        const deletedPeople = people[emailx]
        people.splice(emailx, 1)
        return deletedPeople
        }
    }
}