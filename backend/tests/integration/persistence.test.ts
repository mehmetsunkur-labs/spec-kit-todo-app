import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, reopenTestApp, type TestApp } from '../helpers.js';

// SC-004 / FR-011: saved todos survive a server restart unchanged.
describe('persistence across server restarts', () => {
  let t: TestApp | undefined;

  afterEach(async () => {
    await t?.close();
  });

  async function restart(current: TestApp): Promise<TestApp> {
    // Close the app and DB but keep the file, then start again on the same file.
    await current.app.close();
    current.db.close();
    return reopenTestApp(current.dbPath);
  }

  it('keeps created todos with the same id, description, status and creation time', async () => {
    t = await createTestApp();
    for (const description of ['One', 'Two 🎉', 'Three']) {
      await t.app.inject({ method: 'POST', url: '/api/todos', payload: { description } });
    }
    const before = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json();

    t = await restart(t);

    const after = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json();
    expect(after.items).toHaveLength(3);
    expect(after).toEqual(before);
  });

  it('keeps a completed status after a restart (US2-AS3)', async () => {
    t = await createTestApp();
    const created = (
      await t.app.inject({ method: 'POST', url: '/api/todos', payload: { description: 'Done' } })
    ).json();
    await t.app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { completed: true },
    });

    t = await restart(t);

    const { items } = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json();
    expect(items).toEqual([expect.objectContaining({ id: created.id, completed: true })]);
  });

  it('keeps a deleted todo gone after a restart (US3-AS2)', async () => {
    t = await createTestApp();
    const ids: string[] = [];
    for (const description of ['keep', 'drop']) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { description },
      });
      ids.push(res.json().id);
    }
    await t.app.inject({ method: 'DELETE', url: `/api/todos/${ids[1]}` });

    t = await restart(t);

    const { items } = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json();
    expect(items.map((i: { id: string }) => i.id)).toEqual([ids[0]]);
  });
});
