using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QueueDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPushSubscription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PushSubscription",
                table: "queue_customers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PushSubscription",
                table: "queue_customers");
        }
    }
}
