import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

        const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
        this.logger.error({ url: req.url, method: req.method, status, err: exception instanceof Error ? exception.stack : exception });

        res.status(status).json({
            statusCode: status,
            message,
            path: req.url,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || undefined,
        });
    }
}
