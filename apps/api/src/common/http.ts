import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, PipeTransform, BadRequestException, Logger } from '@nestjs/common';
import { ZodTypeAny } from 'zod';
import type { Response } from 'express';
import { Body } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';
const schemaToOpenApi: (schema: ZodTypeAny, options: Record<string, unknown>) => any = zodToJsonSchema as any;
export function ValidatedBody(schema: ZodTypeAny): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodPipe(schema))(target, key, index);
    if (key !== undefined) ApiBody({ schema: schemaToOpenApi(schema, { target: 'openApi3', $refStrategy: 'none' }) })(target, key, Object.getOwnPropertyDescriptor(target, key)!);
  };
}
@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}
  transform(value: unknown) { const result = this.schema.safeParse(value); if (!result.success) throw new BadRequestException({ message: 'Datos inválidos', errors: result.error.flatten() }); return result.data; }
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(error: any, host: ArgumentsHost) {
    let status = 500; let message: any = 'Error interno';
    if (error instanceof HttpException) { status = error.getStatus(); message = error.getResponse(); }
    else if (error?.type === 'entity.too.large') { status = 413; message = 'El JSON supera el límite de 4 MB'; }
    else if (error?.code === 'P2002') { status = 409; message = 'El registro ya existe'; }
    else if (error?.code === 'P2003') { status = 409; message = 'Existen referencias dependientes'; }
    else if (error?.code === 'P2025') { status = 404; message = 'Registro no encontrado'; }
    else if (['P1001', 'P1002', 'P1017'].includes(error?.code) || error?.name === 'PrismaClientInitializationError') { status = 503; message = 'Servicio temporalmente no disponible'; }
    else this.logger.error(error?.name ?? 'InternalError');
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, ...(typeof message === 'object' ? message : { message }) });
  }
}
