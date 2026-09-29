import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PolicyEngine } from './policy-engine';
import { REFUND_POLICY } from './policy.config';
import { PolicyDecision, PolicyInput } from './policy.types';

@Injectable()
export class PolicyService implements OnModuleInit {
  private readonly engine = new PolicyEngine(REFUND_POLICY);
  private document = '';

  async onModuleInit() {
    this.document = await readFile(join(__dirname, 'refund-policy.md'), 'utf8');
  }

  evaluate(input: PolicyInput): PolicyDecision {
    return this.engine.evaluate(input);
  }

  get markdown(): string {
    return this.document;
  }

  get config() {
    return REFUND_POLICY;
  }
}
