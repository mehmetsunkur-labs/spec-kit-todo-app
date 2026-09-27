import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteTodoRepository, type TodoRepository } from '../../src/todos/repository.js';
import { createTestApp, type TestApp } from '../helpers.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_UTC_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('SqliteTodoRepository', () => {
  let t: TestApp;
  let repo: TodoRepository;

  beforeEach(async () => {
    t = await createTestApp();
    repo = createSqliteTodoRepository(t.db);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await t.close();
  });

  describe('create', () => {
    it('returns a new active todo with a UUID v4 and matching ISO timestamps', () => {
      const todo = repo.create('local', 'A');
      expect(todo.id).toMatch(UUID_V4);
      expect(todo.description).toBe('A');
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toMatch(ISO_UTC_MS);
      expect(todo.updatedAt).toBe(todo.createdAt);
    });

    it('stores text exactly as given', () => {
      const text = '日本語テキスト 🎉 <img src=x onerror=alert(1)>';
      repo.create('local', text);
      expect(repo.list('local')[0]?.description).toBe(text);
    });
  });

  describe('list', () => {
    it('returns an empty array when there are no todos', () => {
      expect(repo.list('local')).toEqual([]);
    });

    it('orders newest first by creation time', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-27T10:00:00.000Z'));
      repo.create('local', 'first');
      vi.setSystemTime(new Date('2026-09-27T10:00:01.000Z'));
      repo.create('local', 'second');
      vi.setSystemTime(new Date('2026-09-27T10:00:02.000Z'));
      repo.create('local', 'third');

      expect(repo.list('local').map((t) => t.description)).toEqual(['third', 'second', 'first']);
    });

    it('orders todos created in the same millisecond newest first (regression)', () => {
      // Random UUIDs used to break ties, so same-millisecond todos came back shuffled.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-27T10:00:00.000Z'));
      const descriptions = Array.from({ length: 20 }, (_, i) => `Task ${i + 1}`);
      for (const description of descriptions) repo.create('local', description);

      expect(repo.list('local').map((t) => t.description)).toEqual([...descriptions].reverse());
    });

    it("never returns another owner's todos (FR-019)", () => {
      repo.create('local', 'mine');
      repo.create('someone-else', 'theirs');
      expect(repo.list('local').map((t) => t.description)).toEqual(['mine']);
      expect(repo.list('someone-else').map((t) => t.description)).toEqual(['theirs']);
    });
  });

  describe('setCompleted', () => {
    it('switches between completed and active, bumping updatedAt but not createdAt', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-27T10:00:00.000Z'));
      const todo = repo.create('local', 'A');

      vi.setSystemTime(new Date('2026-09-27T10:05:00.000Z'));
      const done = repo.setCompleted('local', todo.id, true);
      expect(done).toMatchObject({ id: todo.id, completed: true, createdAt: todo.createdAt });
      expect(done!.updatedAt).toBe('2026-09-27T10:05:00.000Z');

      vi.setSystemTime(new Date('2026-09-27T10:06:00.000Z'));
      const active = repo.setCompleted('local', todo.id, false);
      expect(active).toMatchObject({ completed: false, updatedAt: '2026-09-27T10:06:00.000Z' });
      expect(repo.list('local')[0]).toEqual(active);
    });

    it('is idempotent: setting the same value twice succeeds both times', () => {
      const todo = repo.create('local', 'A');
      expect(repo.setCompleted('local', todo.id, true)?.completed).toBe(true);
      expect(repo.setCompleted('local', todo.id, true)?.completed).toBe(true);
    });

    it('returns null for an unknown id', () => {
      expect(repo.setCompleted('local', crypto.randomUUID(), true)).toBeNull();
    });

    it("returns null for another owner's todo and leaves it unchanged", () => {
      const theirs = repo.create('someone-else', 'theirs');
      expect(repo.setCompleted('local', theirs.id, true)).toBeNull();
      expect(repo.list('someone-else')[0]?.completed).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes the todo and returns true', () => {
      const keep = repo.create('local', 'keep');
      const drop = repo.create('local', 'drop');
      expect(repo.delete('local', drop.id)).toBe(true);
      expect(repo.list('local')).toEqual([keep]);
    });

    it('returns false when deleting the same todo twice', () => {
      const todo = repo.create('local', 'A');
      expect(repo.delete('local', todo.id)).toBe(true);
      expect(repo.delete('local', todo.id)).toBe(false);
    });

    it("returns false for another owner's todo and leaves it in place", () => {
      const theirs = repo.create('someone-else', 'theirs');
      expect(repo.delete('local', theirs.id)).toBe(false);
      expect(repo.list('someone-else')).toHaveLength(1);
    });
  });
});
