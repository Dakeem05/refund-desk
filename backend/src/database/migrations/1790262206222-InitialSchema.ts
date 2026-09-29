import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790262206222 implements MigrationInterface {
  name = 'InitialSchema1790262206222';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "sku" character varying NOT NULL, "name" character varying NOT NULL, "category" character varying NOT NULL, "unit_price_cents" integer NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "is_final_sale" boolean NOT NULL DEFAULT false, "refunded_quantity" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_number" character varying NOT NULL, "customer_id" uuid NOT NULL, "status" "public"."orders_status_enum" NOT NULL, "placed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "delivered_at" TIMESTAMP WITH TIME ZONE, "total_cents" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_75eba1c6b1a66b09f2a97e6927" ON "orders" ("order_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying, "customer_since" TIMESTAMP WITH TIME ZONE NOT NULL, "is_flagged" boolean NOT NULL DEFAULT false, "risk_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8536b8b85c06969f84f0c098b03" UNIQUE ("email"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."refund_requests_reason_enum" AS ENUM('DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'NOT_RECEIVED', 'CHANGED_MIND', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."refund_status" AS ENUM('APPROVED', 'DENIED', 'ESCALATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "refund_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reference" character varying NOT NULL, "idempotency_key" character varying, "customer_id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_message" text NOT NULL, "requested_item_ids" jsonb NOT NULL DEFAULT '[]', "approved_item_ids" jsonb NOT NULL DEFAULT '[]', "reason" "public"."refund_requests_reason_enum", "automated_decision" "public"."refund_status" NOT NULL, "status" "public"."refund_status" NOT NULL, "decision_code" character varying NOT NULL, "refund_amount_cents" integer NOT NULL DEFAULT '0', "requested_amount_cents" integer NOT NULL DEFAULT '0', "flags" text array NOT NULL DEFAULT '{}', "classification" jsonb, "policy_checks" jsonb NOT NULL DEFAULT '[]', "customer_reply" text, "ai_provider" character varying, "ai_model" character varying, "processing_ms" integer, "resolved_by" character varying, "resolution_note" text, "resolved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_00c88ecd40a63abe92a3dc69897" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f0b86dcfb3d7254d54ae6940f1" ON "refund_requests" ("reference") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a628021319b53b93e48c142a35" ON "refund_requests" ("idempotency_key") WHERE idempotency_key IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41ecc6daf51bf70bb55597e2f0" ON "refund_requests" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d230e5f0bf833679b68a8ffe13" ON "refund_requests" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1006e1476205567ffd3297ef8e" ON "refund_requests" ("created_at") `,
    );
    // Added by hand: customer refund history lookups (frequent-refunder rule, admin detail view)
    await queryRunner.query(
      `CREATE INDEX "IDX_refund_requests_customer_status_created" ON "refund_requests" ("customer_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_email_lower" ON "customers" (LOWER("email"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_events_type_enum" AS ENUM('REQUEST_RECEIVED', 'INPUT_SCREENED', 'AI_CLASSIFICATION', 'AI_FALLBACK', 'POLICY_EVALUATED', 'DECISION_MADE', 'REPLY_GENERATED', 'REPLY_REJECTED', 'HUMAN_REVIEW')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "seq" SERIAL NOT NULL, "refund_request_id" uuid NOT NULL, "type" "public"."audit_events_type_enum" NOT NULL, "actor" character varying NOT NULL, "summary" text NOT NULL, "data" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f5a76acf62375631a1403a5e74" ON "audit_events" ("refund_request_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refund_requests" ADD CONSTRAINT "FK_158b6be21ab23fc22020e4ebc2f" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refund_requests" ADD CONSTRAINT "FK_41ecc6daf51bf70bb55597e2f03" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_f5a76acf62375631a1403a5e745" FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_f5a76acf62375631a1403a5e745"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refund_requests" DROP CONSTRAINT "FK_41ecc6daf51bf70bb55597e2f03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refund_requests" DROP CONSTRAINT "FK_158b6be21ab23fc22020e4ebc2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_f5a76acf62375631a1403a5e74"`);
    await queryRunner.query(`DROP TABLE "audit_events"`);
    await queryRunner.query(`DROP TYPE "public"."audit_events_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_customers_email_lower"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refund_requests_customer_status_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1006e1476205567ffd3297ef8e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d230e5f0bf833679b68a8ffe13"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_41ecc6daf51bf70bb55597e2f0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a628021319b53b93e48c142a35"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f0b86dcfb3d7254d54ae6940f1"`);
    await queryRunner.query(`DROP TABLE "refund_requests"`);
    await queryRunner.query(`DROP TYPE "public"."refund_status"`);
    await queryRunner.query(`DROP TYPE "public"."refund_requests_reason_enum"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_75eba1c6b1a66b09f2a97e6927"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
  }
}
