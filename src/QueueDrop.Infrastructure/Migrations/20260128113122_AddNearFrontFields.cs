using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QueueDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNearFrontFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Settings_NearFrontThreshold",
                table: "queues",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NearFrontNotifiedAt",
                table: "queue_customers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "queues",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"),
                column: "Settings_NearFrontThreshold",
                value: null);

            migrationBuilder.UpdateData(
                table: "queues",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                column: "Settings_NearFrontThreshold",
                value: null);

            migrationBuilder.UpdateData(
                table: "queues",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                column: "Settings_NearFrontThreshold",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Settings_NearFrontThreshold",
                table: "queues");

            migrationBuilder.DropColumn(
                name: "NearFrontNotifiedAt",
                table: "queue_customers");
        }
    }
}
