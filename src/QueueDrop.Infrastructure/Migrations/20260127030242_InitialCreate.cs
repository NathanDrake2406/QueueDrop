using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QueueDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "businesses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_businesses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "queues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsPaused = table.Column<bool>(type: "boolean", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uuid", nullable: false),
                    settings_max_queue_size = table.Column<int>(type: "integer", nullable: true),
                    settings_estimated_service_time_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    settings_allow_join_when_paused = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    settings_no_show_timeout_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    settings_welcome_message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    settings_called_message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_queues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_queues_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "queue_customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    JoinPosition = table.Column<int>(type: "integer", nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CalledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ServedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    QueueId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PartySize = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_queue_customers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_queue_customers_queues_QueueId",
                        column: x => x.QueueId,
                        principalTable: "queues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "businesses",
                columns: new[] { "Id", "CreatedAt", "Description", "Name", "Slug" },
                values: new object[] { new Guid("11111111-1111-1111-1111-111111111111"), new DateTimeOffset(new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "A demo business for testing QueueDrop", "Demo Shop", "demo-shop" });

            migrationBuilder.InsertData(
                table: "queues",
                columns: new[] { "Id", "BusinessId", "CreatedAt", "IsActive", "IsPaused", "Name", "RowVersion", "settings_called_message", "settings_estimated_service_time_minutes", "settings_max_queue_size", "settings_no_show_timeout_minutes", "settings_welcome_message" },
                values: new object[] { new Guid("22222222-2222-2222-2222-222222222222"), new Guid("11111111-1111-1111-1111-111111111111"), new DateTimeOffset(new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, false, "Main Queue", new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 }, null, 5, null, 5, null });

            migrationBuilder.CreateIndex(
                name: "IX_businesses_Slug",
                table: "businesses",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_queue_customers_QueueId",
                table: "queue_customers",
                column: "QueueId");

            migrationBuilder.CreateIndex(
                name: "IX_queue_customers_QueueId_JoinedAt",
                table: "queue_customers",
                columns: new[] { "QueueId", "JoinedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_queue_customers_QueueId_Status",
                table: "queue_customers",
                columns: new[] { "QueueId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_queue_customers_Token",
                table: "queue_customers",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_queues_BusinessId",
                table: "queues",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_queues_BusinessId_IsActive",
                table: "queues",
                columns: new[] { "BusinessId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "queue_customers");

            migrationBuilder.DropTable(
                name: "queues");

            migrationBuilder.DropTable(
                name: "businesses");
        }
    }
}
