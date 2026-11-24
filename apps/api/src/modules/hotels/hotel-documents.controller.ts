import { Controller, Delete, Get, HttpCode, Post, Req } from "@nestjs/common";
import {
  documentTypeMaxBytes,
  hotelDocumentUploadQuery,
  uuid,
  type DocumentLinkView,
  type HotelDocumentList,
  type HotelDocumentRemovedResponse,
  type HotelDocumentUploadQuery,
  type HotelDocumentView,
} from "@ampm/core";
import type { Request } from "express";
import { z } from "zod";

import { octetStreamBody, readBoundedBody } from "../../common/bounded-body.js";
import { UploadRoute } from "../../common/upload-slot/upload-route.decorator.js";
import { ZodParams, ZodQuery } from "../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../policy/decorators.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { HotelDocumentsService } from "./hotel-documents.service.js";

const hotelParam = z.object({ hotelId: uuid }).strict();
type HotelParam = z.infer<typeof hotelParam>;
const documentParam = z.object({ hotelId: uuid, documentId: uuid }).strict();
type DocumentParam = z.infer<typeof documentParam>;

/**
 * A hotel's documents library (D-187 §6), under the `hotels-admin` prefix beside the other staff hotel
 * routes, keyed `hotels.hotel_documents.*` (permission-matrix §5.3: SA and HT CRUD, SM and PM read; a
 * role without the read key is answered 404). The upload takes the file as the raw
 * `application/octet-stream` body, read after the guards, the query, an upload slot and the service's
 * checks that need no file, up to the largest file the document type takes (D-187 §1: 25 MiB for a
 * fact sheet, 20 MiB otherwise). Its service audits every change in its own transaction, the link's
 * minting included.
 */
@Controller("hotels-admin")
export class HotelDocumentsController {
  constructor(private readonly documents: HotelDocumentsService) {}

  @Get("hotels/:hotelId/documents")
  @RequirePermission("hotels.hotel_documents.read")
  list(@ZodParams(hotelParam) params: HotelParam): Promise<HotelDocumentList> {
    return this.documents.list(params.hotelId);
  }

  // The service reads the body through the reader handed to it, and only once its checks that need no
  // file (the hotel, the cap, the update key, the document replaced) have passed.
  @Post("hotels/:hotelId/documents")
  @RequirePermission("hotels.hotel_documents.create")
  @UploadRoute()
  @HttpCode(201)
  @SelfAudited()
  upload(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodQuery(hotelDocumentUploadQuery) query: HotelDocumentUploadQuery,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelDocumentView> {
    return this.documents.upload(params.hotelId, query, principal, () =>
      readBoundedBody(req, octetStreamBody(documentTypeMaxBytes(query.type))),
    );
  }

  @Delete("hotels/:hotelId/documents/:documentId")
  @RequirePermission("hotels.hotel_documents.delete")
  @SelfAudited()
  remove(
    @ZodParams(documentParam) params: DocumentParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelDocumentRemovedResponse> {
    return this.documents.remove(params.hotelId, params.documentId, staffId(principal));
  }

  @Post("hotels/:hotelId/documents/:documentId/link")
  @RequirePermission("hotels.hotel_documents.read")
  @HttpCode(201)
  @SelfAudited()
  link(
    @ZodParams(documentParam) params: DocumentParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<DocumentLinkView> {
    return this.documents.link(params.hotelId, params.documentId, staffId(principal));
  }
}
