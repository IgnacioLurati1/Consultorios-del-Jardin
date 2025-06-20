export interface Repository<T> {
  findAll(): T[] | undefined
  findOne(item: { idProvince: string }): T | undefined
  add(item: T): T | undefined
  update(item: T): T | undefined
  delete(item: { idProvince: string }): T | undefined
}