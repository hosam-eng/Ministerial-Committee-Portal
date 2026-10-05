-- Additive: distinguish unchanged re-publication after unpublish.
ALTER TYPE "publishing"."NewsPublicationAction" ADD VALUE 'REPUBLISH';
