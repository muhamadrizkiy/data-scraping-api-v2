/* eslint-disable no-empty-function */
import { Injectable, HttpStatus, HttpException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ResponseDto } from "../shared/dto/response.dto";
import { Customer } from "./interfaces/customer.interface";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { merge } from "../shared/utils/mapping.utils";
import * as data from "../shared/utils/data.json";
import { scraper } from "../shared/utils/scraper.utils";

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel("Customer") private readonly CustomerModel: Model<Customer>
  ) {}

  async getCustomers(): Promise<ResponseDto> {
    const customers: Customer[] = await this.CustomerModel.find().exec();

    if (!customers.length) {
      const response = new ResponseDto(
        HttpStatus.NOT_FOUND,
        "Bank customer account does not exist"
      );
      throw new HttpException(response, response.statusCode);
    }

    return new ResponseDto(
      HttpStatus.OK,
      "Bank customer account Found",
      customers
    );
  }

  async addCustomer(
    createCustomerDto: CreateCustomerDto
  ): Promise<ResponseDto> {
    const scraperResult = await scraper(
      createCustomerDto.username,
      createCustomerDto.password
    );
    const mergeResult = await merge(data, scraperResult.result);
    const newCustomer: Customer = new this.CustomerModel(mergeResult);
    await newCustomer.save();

    if (scraperResult.errors.length) {
      const response = new ResponseDto(
        HttpStatus.SERVICE_UNAVAILABLE,
        scraperResult.errors[0]
      );
      throw new HttpException(response, response.statusCode);
    }

    return new ResponseDto(
      HttpStatus.CREATED,
      "Bank customer account has been submitted successfully",
      newCustomer
    );
  }
}
