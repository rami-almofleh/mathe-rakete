import { findTopic } from '../curriculum/curriculum';
import { TaskGenerator } from './generator';

/** Ordnet jedem Thema aus dem Lehrplan-Katalog genau einen Generator zu. */
export class GeneratorRegistry {
  private readonly byTopic = new Map<string, TaskGenerator>();

  constructor(generators: readonly TaskGenerator[] = []) {
    generators.forEach((g) => this.register(g));
  }

  register(generator: TaskGenerator): void {
    if (!findTopic(generator.topicId)) {
      throw new Error(`Unbekanntes Thema: ${generator.topicId}`);
    }
    if (this.byTopic.has(generator.topicId)) {
      throw new Error(`Für ${generator.topicId} gibt es schon einen Generator`);
    }
    this.byTopic.set(generator.topicId, generator);
  }

  get(topicId: string): TaskGenerator | undefined {
    return this.byTopic.get(topicId);
  }

  has(topicId: string): boolean {
    return this.byTopic.has(topicId);
  }

  get topicIds(): string[] {
    return [...this.byTopic.keys()];
  }
}
