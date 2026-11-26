export interface IAppErrorDetail {
    field: string;
    message: string;
}

class AppError extends Error {
    public statusCode: number;
    public errors: IAppErrorDetail[] | undefined;

    constructor(
        statusCode: number,
        message: string,
        errors?: IAppErrorDetail[],
    ) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.errors = errors;
    }
}

export default AppError;
