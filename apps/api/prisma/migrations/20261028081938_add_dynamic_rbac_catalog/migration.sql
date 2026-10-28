-- CreateTable
CREATE TABLE "grantable_capabilities" (
    "id" UUID NOT NULL,
    "capability_key" VARCHAR(255) NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "resource" VARCHAR(128) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "conditions" JSONB NOT NULL,
    "source_roles" JSONB NOT NULL,
    "is_staff_only" BOOLEAN NOT NULL DEFAULT true,
    "is_escalation_locked" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grantable_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_sets" (
    "id" UUID NOT NULL,
    "set_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "permission_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_grants" (
    "role_id" UUID NOT NULL,
    "grantable_capability_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "role_grants_pkey" PRIMARY KEY ("role_id","grantable_capability_id")
);

-- CreateTable
CREATE TABLE "permission_set_grants" (
    "permission_set_id" UUID NOT NULL,
    "grantable_capability_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "permission_set_grants_pkey" PRIMARY KEY ("permission_set_id","grantable_capability_id")
);

-- CreateTable
CREATE TABLE "role_permission_sets" (
    "role_id" UUID NOT NULL,
    "permission_set_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "role_permission_sets_pkey" PRIMARY KEY ("role_id","permission_set_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grantable_capabilities_capability_key_key" ON "grantable_capabilities"("capability_key");

-- CreateIndex
CREATE INDEX "grantable_capabilities_module_resource_idx" ON "grantable_capabilities"("module", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "permission_sets_set_key_key" ON "permission_sets"("set_key");

-- CreateIndex
CREATE INDEX "permission_sets_deleted_at_idx" ON "permission_sets"("deleted_at");

-- CreateIndex
CREATE INDEX "role_grants_grantable_capability_id_idx" ON "role_grants"("grantable_capability_id");

-- CreateIndex
CREATE INDEX "permission_set_grants_grantable_capability_id_idx" ON "permission_set_grants"("grantable_capability_id");

-- CreateIndex
CREATE INDEX "role_permission_sets_permission_set_id_idx" ON "role_permission_sets"("permission_set_id");

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_grantable_capability_id_fkey" FOREIGN KEY ("grantable_capability_id") REFERENCES "grantable_capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_grants" ADD CONSTRAINT "permission_set_grants_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_grants" ADD CONSTRAINT "permission_set_grants_grantable_capability_id_fkey" FOREIGN KEY ("grantable_capability_id") REFERENCES "grantable_capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission_sets" ADD CONSTRAINT "role_permission_sets_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission_sets" ADD CONSTRAINT "role_permission_sets_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
