using Microsoft.EntityFrameworkCore;
using CanBusApi.Models;

namespace CanBusApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<PredictionLog> PredictionLogs { get; set; }
}