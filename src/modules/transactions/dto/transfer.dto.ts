import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class TransferDto {
  @ApiProperty()
  @IsUUID()
  fromAccountId!: string;

  @ApiProperty()
  @IsUUID()
  toAccountId!: string;

  @ApiProperty({ example: 5000, description: 'Amount in minor units' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'INR' })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
