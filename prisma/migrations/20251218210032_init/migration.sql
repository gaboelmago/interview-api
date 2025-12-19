-- CreateTable
CREATE TABLE "TreeNode" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "TreeNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreeNode_parentId_idx" ON "TreeNode"("parentId");

-- AddForeignKey
ALTER TABLE "TreeNode" ADD CONSTRAINT "TreeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TreeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
