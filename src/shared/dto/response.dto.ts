import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class ResponseDto {
  @IsNumber()
  @IsNotEmpty()
  readonly statusCode: number;

  @IsString()
  @IsNotEmpty()
  readonly message: string;

  @IsOptional()
  readonly data: any;

  constructor(statusCode: number, message: string, data?: any) {
    this.statusCode = statusCode;
    this.message = message;
    if (data) {
      this.data = data;
    }
  }
}
