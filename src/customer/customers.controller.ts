import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  Req
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getCustomers() {
    return this.customersService.getCustomers();
  }
  // 
  @Post()
  async addCustomers(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.addCustomer(createCustomerDto);
  }
}
