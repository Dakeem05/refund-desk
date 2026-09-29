import { Controller, Get } from '@nestjs/common';
import { PolicyService } from './policy.service';

@Controller('policy')
export class PolicyController {
  constructor(private readonly policy: PolicyService) {}

  @Get()
  getPolicy() {
    return {
      version: this.policy.config.version,
      markdown: this.policy.markdown,
      rules: this.policy.config,
    };
  }
}
