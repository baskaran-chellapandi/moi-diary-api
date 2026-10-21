import { MongoMemoryReplSet } from 'mongodb-memory-server';

export function startTestMongo() {
  return MongoMemoryReplSet.create({ replSet: { count: 1 } });
}
