import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersService } from './customers.service';
import { CustomersSchema } from './schemas/customer.schema';
import { CustomersController } from './customers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Customer', schema: CustomersSchema }])
  ],
  providers: [CustomersService],
  controllers: [CustomersController]
})
export class CustomersModule {}
