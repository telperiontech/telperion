import { EntityNotFoundError, In, IsNull, LessThan, MoreThan, type Repository } from 'typeorm';

import { MemoryRepository } from './memory-repository';
import { UnsupportedQueryError } from './unsupported-query-error';

interface User {
  id: string;
  email: string;
  age: number;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface Code {
  code: number;
  label: string;
}

async function seed(repository: MemoryRepository<User>): Promise<User[]> {
  return repository.save([
    { id: 'u1', email: 'a@example.com', age: 30, deletedAt: null },
    { id: 'u2', email: 'b@example.com', age: 20, deletedAt: new Date('2026-01-01') },
    { id: 'u3', email: 'c@example.com', age: 40, deletedAt: null },
  ]);
}

describe('MemoryRepository', () => {
  let users: MemoryRepository<User>;

  beforeEach(() => {
    users = new MemoryRepository<User>();
  });

  it('should cast to a TypeORM repository', () => {
    const repository: Repository<User> = users.asRepository();

    expect(repository).toBe(users);
  });

  describe('create', () => {
    it('should return a copy of the data without storing it', () => {
      const data = { email: 'a@example.com' };
      const created = users.create(data);

      expect(created).toEqual(data);
      expect(created).not.toBe(data);
      expect(users.rows).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('should insert an entity without a primary key with a generated UUID', async () => {
      const entity = users.create({ email: 'a@example.com', age: 30, deletedAt: null });
      const saved = await users.save(entity);

      expect(saved).toBe(entity);
      expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(users.rows).toEqual([saved]);
    });

    it('should insert an entity with an unknown primary key as it is', async () => {
      await users.save({ id: 'given', email: 'a@example.com' });

      expect(users.rows.map(({ id }) => id)).toEqual(['given']);
    });

    it('should replace the stored row with the same primary key', async () => {
      await seed(users);
      await users.save({ id: 'u2', email: 'changed@example.com', age: 21, deletedAt: null });

      expect(users.rows).toHaveLength(3);
      expect(users.rows[1]).toEqual({ id: 'u2', email: 'changed@example.com', age: 21, deletedAt: null });
    });

    it('should save an array', async () => {
      const saved = await seed(users);

      expect(saved.map(({ id }) => id)).toEqual(['u1', 'u2', 'u3']);
      expect(users.rows).toHaveLength(3);
    });

    it('should not add date columns unless configured', async () => {
      const saved = await users.save({ email: 'a@example.com' });

      expect(Object.keys(saved).sort()).toEqual(['email', 'id']);
    });

    it('should fill the configured date columns', async () => {
      const stamped = new MemoryRepository<User>({ createDateColumn: 'createdAt', updateDateColumn: 'updatedAt' });
      const created = new Date('2020-01-01');
      const first = await stamped.save({ email: 'a@example.com' });
      const second = await stamped.save({ email: 'b@example.com', createdAt: created });

      expect(first.createdAt).toBeInstanceOf(Date);
      expect(first.updatedAt).toEqual(first.createdAt);
      expect(second.createdAt).toBe(created);

      const firstCreatedAt = first.createdAt;

      await new Promise(resolve => setTimeout(resolve, 5));
      await stamped.save(first);

      expect(first.createdAt).toBe(firstCreatedAt);
      expect(first.updatedAt!.getTime()).toBeGreaterThan(firstCreatedAt!.getTime());
    });

    it('should use the configured primary key and id generator', async () => {
      const ids = [100, 101][Symbol.iterator]();
      const codes = new MemoryRepository<Code>({ primaryKey: 'code', generateId: () => ids.next().value });

      await codes.save([{ label: 'a' }, { label: 'b' }, { code: 7, label: 'c' }]);
      await codes.save({ code: 100, label: 'a2' });

      expect(codes.rows).toEqual([
        { code: 100, label: 'a2' },
        { code: 101, label: 'b' },
        { code: 7, label: 'c' },
      ]);
    });
  });

  describe('find', () => {
    beforeEach(() => seed(users));

    it('should return all rows without options', async () => {
      expect(await users.find()).toHaveLength(3);
    });

    it('should filter with where', async () => {
      expect((await users.find({ where: { deletedAt: IsNull() } })).map(({ id }) => id)).toEqual(['u1', 'u3']);
      expect((await users.findBy({ age: MoreThan(25) })).map(({ id }) => id)).toEqual(['u1', 'u3']);
    });

    it('should accept an array of where conditions (OR)', async () => {
      expect((await users.findBy([{ id: 'u1' }, { age: LessThan(25) }])).map(({ id }) => id)).toEqual(['u1', 'u2']);
    });

    it('should order by several keys', async () => {
      await users.save({ id: 'u4', email: 'd@example.com', age: 30, deletedAt: null });

      expect((await users.find({ order: { age: 'DESC', email: 'DESC' } })).map(({ id }) => id)).toEqual(['u3', 'u4', 'u1', 'u2']);
    });

    it('should page with skip and take', async () => {
      const ordered = { order: { age: 'ASC' as const } };

      expect((await users.find({ ...ordered, take: 2 })).map(({ id }) => id)).toEqual(['u2', 'u1']);
      expect((await users.find({ ...ordered, skip: 1 })).map(({ id }) => id)).toEqual(['u1', 'u3']);
      expect((await users.find({ ...ordered, skip: 1, take: 1 })).map(({ id }) => id)).toEqual(['u1']);
      expect(await users.find({ ...ordered, skip: 5 })).toEqual([]);
    });

    it('should find one row', async () => {
      expect((await users.findOneBy({ email: 'c@example.com' }))?.id).toBe('u3');
      expect((await users.findOne({ where: { deletedAt: IsNull() }, order: { age: 'DESC' } }))?.id).toBe('u3');
      expect(await users.findOneBy({ email: 'nobody@example.com' })).toBeNull();
    });

    it('should throw EntityNotFoundError when one row is required', async () => {
      const named = new MemoryRepository<User>({ name: 'User' });

      await expect(users.findOneByOrFail({ id: 'u1' })).resolves.toMatchObject({ id: 'u1' });
      await expect(users.findOneOrFail({ where: { id: 'u1' } })).resolves.toMatchObject({ id: 'u1' });
      await expect(users.findOneByOrFail({ id: 'missing' })).rejects.toBeInstanceOf(EntityNotFoundError);
      await expect(users.findOneOrFail({ where: { id: 'missing' } })).rejects.toBeInstanceOf(EntityNotFoundError);
      await expect(named.findOneByOrFail({ id: 'missing' })).rejects.toThrow('Could not find any entity of type "User"');
    });

    it('should count and check existence', async () => {
      expect(await users.count()).toBe(3);
      expect(await users.count({ where: { deletedAt: IsNull() } })).toBe(2);
      expect(await users.countBy({ age: MoreThan(100) })).toBe(0);
      expect(await users.exists({ where: { id: 'u2' } })).toBe(true);
      expect(await users.existsBy({ id: 'missing' })).toBe(false);
    });

    it('should find a page and count all matches', async () => {
      const [page, total] = await users.findAndCount({ where: { deletedAt: IsNull() }, order: { age: 'ASC' }, take: 1 });

      expect(page.map(({ id }) => id)).toEqual(['u1']);
      expect(total).toBe(2);
    });

    it('should throw for null conditions, like TypeORM 1.x', async () => {
      await expect(users.findOneBy({ deletedAt: null } as never)).rejects.toThrow(UnsupportedQueryError);
    });

    it('should expose UnsupportedQueryError as a static member', () => {
      expect(MemoryRepository.UnsupportedQueryError).toBe(UnsupportedQueryError);
    });
  });

  describe('update', () => {
    beforeEach(() => seed(users));

    it('should update by where conditions', async () => {
      const result = await users.update({ deletedAt: IsNull() }, { age: 99 });

      expect(result).toEqual({ raw: [], affected: 2, generatedMaps: [] });
      expect(users.rows.map(({ age }) => age)).toEqual([99, 20, 99]);
    });

    it('should update by primary key values', async () => {
      expect((await users.update('u2', { age: 21 })).affected).toBe(1);
      expect((await users.update(['u1', 'u3'], { age: 50 })).affected).toBe(2);
      expect(users.rows.map(({ age }) => age)).toEqual([50, 21, 50]);
    });

    it('should report no affected rows when nothing matches', async () => {
      expect((await users.update('missing', { age: 1 })).affected).toBe(0);
    });

    it('should set the update date column', async () => {
      const stamped = new MemoryRepository<User>({ updateDateColumn: 'updatedAt' });
      const [user] = await seed(stamped);
      const before = user.updatedAt!;

      await new Promise(resolve => setTimeout(resolve, 5));
      await stamped.update('u1', { age: 31 });

      expect(user.updatedAt!.getTime()).toBeGreaterThan(before.getTime());
    });

    it('should reject empty criteria', async () => {
      await expect(users.update({}, { age: 1 })).rejects.toThrow('Empty criteria are not allowed for the update method');
      await expect(users.update([], { age: 1 })).rejects.toThrow(UnsupportedQueryError);
    });
  });

  describe('delete', () => {
    beforeEach(() => seed(users));

    it('should delete by where conditions', async () => {
      expect(await users.delete({ deletedAt: In([new Date('2026-01-01')]) })).toEqual({ raw: [], affected: 1 });
      expect(users.rows.map(({ id }) => id)).toEqual(['u1', 'u3']);
    });

    it('should delete by primary key values', async () => {
      expect((await users.delete('u1')).affected).toBe(1);
      expect((await users.delete(['u2', 'u3', 'missing'])).affected).toBe(2);
      expect(users.rows).toEqual([]);
    });

    it('should keep the rows array instance', async () => {
      const rows = users.rows;

      await users.delete('u1');

      expect(users.rows).toBe(rows);
    });

    it('should reject empty criteria', async () => {
      await expect(users.delete({})).rejects.toThrow('Empty criteria are not allowed for the delete method');
      expect(users.rows).toHaveLength(3);
    });
  });

  describe('remove and clear', () => {
    it('should remove entities by primary key', async () => {
      const [first, second] = await seed(users);

      await expect(users.remove(first)).resolves.toBe(first);
      await expect(users.remove([second])).resolves.toEqual([second]);
      expect(users.rows.map(({ id }) => id)).toEqual(['u3']);
    });

    it('should clear all rows', async () => {
      await seed(users);
      await users.clear();

      expect(users.rows).toEqual([]);
    });
  });
});
