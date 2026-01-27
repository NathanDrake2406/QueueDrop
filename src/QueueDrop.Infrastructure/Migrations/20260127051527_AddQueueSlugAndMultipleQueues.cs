using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace QueueDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQueueSlugAndMultipleQueues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "queues",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "queues",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"),
                column: "Slug",
                value: "main-queue");

            migrationBuilder.InsertData(
                table: "queues",
                columns: new[] { "Id", "BusinessId", "CreatedAt", "IsActive", "IsPaused", "Name", "RowVersion", "Slug", "settings_called_message", "settings_estimated_service_time_minutes", "settings_max_queue_size", "settings_no_show_timeout_minutes", "settings_welcome_message" },
                values: new object[,]
                {
                    { new Guid("33333333-3333-3333-3333-333333333333"), new Guid("11111111-1111-1111-1111-111111111111"), new DateTimeOffset(new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, false, "Takeout", new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 }, "takeout", null, 3, null, 5, null },
                    { new Guid("44444444-4444-4444-4444-444444444444"), new Guid("11111111-1111-1111-1111-111111111111"), new DateTimeOffset(new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, false, "Bar", new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 }, "bar", null, 10, 20, 5, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_queues_BusinessId_Slug",
                table: "queues",
                columns: new[] { "BusinessId", "Slug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_queues_BusinessId_Slug",
                table: "queues");

            migrationBuilder.DeleteData(
                table: "queues",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"));

            migrationBuilder.DeleteData(
                table: "queues",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"));

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "queues");
        }
    }
}
